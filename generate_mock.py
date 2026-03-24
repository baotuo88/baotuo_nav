#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chrome书签读取脚本
读取本地Chrome浏览器收藏栏，生成对应的mock_data.js文件
"""

import json
import os
import platform
import time
import urllib.parse
import datetime
from pathlib import Path
import re


class ChromeBookmarkParser:
    def __init__(self):
        self.bookmarks_path = self.get_chrome_bookmarks_path()
        self.categories = []
        self.my_favorites_sites = []
        
    def get_chrome_user_data_dir(self):
        """获取Chrome用户数据目录"""
        system = platform.system()
        
        if system == "Windows":
            return os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
        elif system == "Darwin":  # macOS
            return os.path.expanduser("~/Library/Application Support/Google/Chrome")
        else:  # Linux
            return os.path.expanduser("~/.config/google-chrome")
    
    def find_chrome_profiles(self):
        """查找所有Chrome配置文件"""
        user_data_dir = self.get_chrome_user_data_dir()
        profiles = []
        
        if not os.path.exists(user_data_dir):
            return profiles
        
        # 查找所有可能的配置文件目录
        profile_dirs = ['Default']  # 默认配置文件
        
        # 查找其他配置文件 (Profile 1, Profile 2, ...)
        for item in os.listdir(user_data_dir):
            item_path = os.path.join(user_data_dir, item)
            if os.path.isdir(item_path) and item.startswith('Profile '):
                profile_dirs.append(item)
        
        # 检查每个配置文件是否有书签文件
        for profile_dir in profile_dirs:
            bookmarks_path = os.path.join(user_data_dir, profile_dir, 'Bookmarks')
            if os.path.exists(bookmarks_path):
                # 尝试读取配置文件信息
                profile_info = self.get_profile_info(user_data_dir, profile_dir)
                profiles.append({
                    'name': profile_dir,
                    'display_name': profile_info.get('name', profile_dir),
                    'email': profile_info.get('email', ''),
                    'last_used': profile_info.get('last_used', ''),
                    'bookmark_count': profile_info.get('bookmark_count', 0),
                    'path': bookmarks_path,
                    'profile_dir': profile_dir
                })
        
        return profiles
    
    def get_profile_info(self, user_data_dir, profile_dir):
        """获取配置文件详细信息"""
        info = {'name': profile_dir, 'email': '', 'last_used': '', 'bookmark_count': 0}
        
        try:
            preferences_path = os.path.join(user_data_dir, profile_dir, 'Preferences')
            if os.path.exists(preferences_path):
                with open(preferences_path, 'r', encoding='utf-8') as f:
                    preferences = json.load(f)
                    
                    # 基本配置信息
                    profile_info = preferences.get('profile', {})
                    info['name'] = profile_info.get('name', profile_dir)
                    
                    # 账号信息 - 尝试多个可能的位置
                    # 方法1: account_info
                    account_info = preferences.get('account_info', [])
                    if account_info and isinstance(account_info, list) and len(account_info) > 0:
                        info['email'] = account_info[0].get('email', '')
                    
                    # 方法2: signin信息
                    if not info['email']:
                        signin_info = preferences.get('signin', {})
                        if isinstance(signin_info, dict):
                            info['email'] = signin_info.get('signin_allowed_on_next_startup', {}).get('email', '')
                    
                    # 方法3: google services
                    if not info['email']:
                        google_services = preferences.get('google', {}).get('services', {})
                        if isinstance(google_services, dict):
                            info['email'] = google_services.get('signin_scoped_device_id', {}).get('email', '')
                    
                    # 方法4: profile info中的用户名
                    if not info['email']:
                        info['email'] = profile_info.get('user_name', '')
                    
                    # 最后使用时间
                    profile_metrics = preferences.get('profile', {}).get('metrics', {})
                    last_used = profile_metrics.get('last_used', 0)
                    if last_used:
                        # Chrome时间戳是从1601年开始的微秒数
                        chrome_epoch = datetime.datetime(1601, 1, 1)
                        last_used_date = chrome_epoch + datetime.timedelta(microseconds=last_used)
                        info['last_used'] = last_used_date.strftime('%Y-%m-%d')
        except Exception as e:
            pass
        
        # 统计书签数量
        try:
            bookmarks_path = os.path.join(user_data_dir, profile_dir, 'Bookmarks')
            if os.path.exists(bookmarks_path):
                with open(bookmarks_path, 'r', encoding='utf-8') as f:
                    bookmarks_data = json.load(f)
                    bookmark_bar = bookmarks_data.get('roots', {}).get('bookmark_bar', {})
                    info['bookmark_count'] = self.count_bookmarks(bookmark_bar)
        except:
            pass
        
        return info
    
    def count_bookmarks(self, node):
        """递归统计书签数量"""
        count = 0
        children = node.get('children', [])
        for child in children:
            if child.get('type') == 'url':
                count += 1
            elif child.get('type') == 'folder':
                count += self.count_bookmarks(child)
        return count
    
    def select_chrome_profile(self):
        """让用户选择Chrome配置文件"""
        profiles = self.find_chrome_profiles()
        
        if not profiles:
            print("未找到任何Chrome配置文件！")
            return None
        
        if len(profiles) == 1:
            profile = profiles[0]
            email_info = f" ({profile['email']})" if profile['email'] else ""
            print(f"找到1个Chrome配置文件: {profile['display_name']}{email_info}")
            return profile['path']
        
        # 按书签数量排序，方便用户选择
        profiles.sort(key=lambda x: x['bookmark_count'], reverse=True)
        
        print(f"找到 {len(profiles)} 个Chrome配置文件:")
        print("=" * 80)
        print(f"{'序号':<4} {'配置名称':<15} {'邮箱地址':<25} {'书签数':<8} {'最后使用':<12} {'文件夹'}")
        print("=" * 80)
        
        for i, profile in enumerate(profiles):
            email = profile['email'][:23] + '...' if len(profile['email']) > 25 else profile['email']
            email = email or '未登录'
            
            last_used = profile['last_used'] or '未知'
            bookmark_count = profile['bookmark_count']
            display_name = profile['display_name'][:13] + '...' if len(profile['display_name']) > 15 else profile['display_name']
            
            print(f"{i + 1:<4} {display_name:<15} {email:<25} {bookmark_count:<8} {last_used:<12} {profile['name']}")
        
        print("=" * 80)
        
        while True:
            try:
                choice = input(f"\n请选择要使用的配置文件 (1-{len(profiles)}) 或 'a' 合并所有: ").strip()
                
                if choice.lower() == 'a':
                    return 'all'  # 特殊标记，表示合并所有配置文件
                
                choice_num = int(choice)
                if 1 <= choice_num <= len(profiles):
                    selected_profile = profiles[choice_num - 1]
                    email_info = f" ({selected_profile['email']})" if selected_profile['email'] else ""
                    print(f"\n✅ 已选择: {selected_profile['display_name']}{email_info}")
                    print(f"   书签数量: {selected_profile['bookmark_count']} 个")
                    return selected_profile['path']
                else:
                    print(f"❌ 请输入 1 到 {len(profiles)} 之间的数字")
            except ValueError:
                print("❌ 请输入有效的数字或 'a'")
    
    def get_chrome_bookmarks_path(self):
        """获取Chrome书签文件路径（兼容旧版本）"""
        profiles = self.find_chrome_profiles()
        if profiles:
            return profiles[0]['path']  # 返回第一个找到的配置文件
        
        # 如果没找到，使用原来的默认路径
        system = platform.system()
        if system == "Windows":
            return os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Default\Bookmarks")
        elif system == "Darwin":  # macOS
            return os.path.expanduser("~/Library/Application Support/Google/Chrome/Default/Bookmarks")
        else:  # Linux
            return os.path.expanduser("~/.config/google-chrome/Default/Bookmarks")
    
    def generate_site_id(self, name, url):
        """生成网站ID"""
        # 使用时间戳和URL生成唯一ID
        timestamp = int(time.time() * 1000)
        return f"site-{timestamp}-{hash(url) % 10000}"
    
    def extract_domain_icon(self, url):
        """从URL提取域名并生成图标路径"""
        try:
            parsed_url = urllib.parse.urlparse(url)
            domain = parsed_url.netloc.lower()
            # 移除www.前缀
            if domain.startswith('www.'):
                icon_name = domain
            else:
                icon_name = domain
            return f"https://www.faviconextractor.com/favicon/{icon_name}"
        except:
            return "/favicon.ico"
    
    def clean_category_name(self, name):
        """清理分类名称"""
        # 移除特殊字符，保留中英文、数字和常用符号
        cleaned = re.sub(r'[^\w\s\u4e00-\u9fff-]', '', name)
        return cleaned.strip() or "其他"
    
    def generate_category_id(self, name):
        """生成分类ID"""
        # 转换为小写并替换空格为连字符
        category_id = re.sub(r'[^\w\u4e00-\u9fff]', '-', name.lower())
        return category_id
    
    def get_category_icon(self, name):
        """根据分类名称获取图标"""
        icon_map = {
            '开发': '🛠️',
            '工具': '⚙️', 
            'AI': '🤖',
            '人工智能': '🤖',
            '设计': '🎨',
            '学习': '📚',
            '教程': '📚',
            '社区': '👥',
            '论坛': '👥',
            '娱乐': '🎮',
            '视频': '📺',
            '音乐': '🎵',
            '购物': '🛒',
            '新闻': '📰',
            '财经': '💰',
            '投资': '💰',
            '云服务': '☁️',
            '办公': '💼',
            '协作': '💼',
            '游戏': '🎮',
            '体育': '⚽',
            '旅游': '✈️',
            '美食': '🍴'
        }
        
        name_lower = name.lower()
        for key, icon in icon_map.items():
            if key in name or key.lower() in name_lower:
                return icon
        
        return '📁'  # 默认文件夹图标
    
    def parse_bookmark_node(self, node, is_root=False):
        """递归解析书签节点"""
        if node.get('type') == 'url':
            # 这是一个书签链接
            site = {
                'id': self.generate_site_id(node.get('name', ''), node.get('url', '')),
                'name': node.get('name', '未命名'),
                'url': node.get('url', ''),
                'description': node.get('name', ''),
                'icon': self.extract_domain_icon(node.get('url', ''))
            }
            return site
        elif node.get('type') == 'folder':
            # 这是一个文件夹
            folder_name = node.get('name', '未命名文件夹')
            sites = []
            
            for child in node.get('children', []):
                if child.get('type') == 'url':
                    site = self.parse_bookmark_node(child)
                    sites.append(site)
                elif child.get('type') == 'folder':
                    # 嵌套文件夹中的链接也添加到当前分类
                    nested_sites = self.parse_folder_sites(child)
                    sites.extend(nested_sites)
            
            if sites:  # 只有当文件夹中有链接时才创建分类
                category = {
                    'id': self.generate_category_id(folder_name),
                    'name': self.clean_category_name(folder_name),
                    'icon': self.get_category_icon(folder_name),
                    'order': len(self.categories) + 1,
                    'sites': sites
                }
                return category
        
        return None
    
    def parse_folder_sites(self, folder_node):
        """递归获取文件夹中的所有链接"""
        sites = []
        for child in folder_node.get('children', []):
            if child.get('type') == 'url':
                site = self.parse_bookmark_node(child)
                sites.append(site)
            elif child.get('type') == 'folder':
                nested_sites = self.parse_folder_sites(child)
                sites.extend(nested_sites)
        return sites
    
    def parse_bookmarks_from_file(self, bookmarks_path, profile_name=""):
        """从指定文件解析书签"""
        try:
            if not os.path.exists(bookmarks_path):
                print(f"书签文件不存在: {bookmarks_path}")
                return False
            
            with open(bookmarks_path, 'r', encoding='utf-8') as f:
                bookmarks_data = json.load(f)
            
            # 获取书签栏
            bookmark_bar = bookmarks_data.get('roots', {}).get('bookmark_bar', {})
            children = bookmark_bar.get('children', [])
            
            profile_suffix = f" ({profile_name})" if profile_name else ""
            print(f"  找到 {len(children)} 个书签栏项目{profile_suffix}")
            
            temp_categories = []
            temp_favorites = []
            
            for item in children:
                if item.get('type') == 'url':
                    # 第一层是网站，放到"我的常用"
                    site = self.parse_bookmark_node(item)
                    if site:
                        temp_favorites.append(site)
                elif item.get('type') == 'folder':
                    # 第一层是文件夹，作为分类
                    category = self.parse_bookmark_node(item)
                    if category:
                        # 如果有多个配置文件，在分类名称后添加配置文件标识
                        if profile_name and profile_name != "Default":
                            category['name'] += f" ({profile_name})"
                            category['id'] += f"-{profile_name.lower().replace(' ', '-')}"
                        temp_categories.append(category)
            
            # 合并到主列表
            self.my_favorites_sites.extend(temp_favorites)
            self.categories.extend(temp_categories)
            
            return True
            
        except Exception as e:
            print(f"解析书签文件 {bookmarks_path} 时出错: {e}")
            return False
    
    def parse_bookmarks(self):
        """解析Chrome书签文件"""
        # 重置数据
        self.categories = []
        self.my_favorites_sites = []
        
        if self.bookmarks_path == 'all':
            # 合并所有配置文件
            profiles = self.find_chrome_profiles()
            print(f"合并 {len(profiles)} 个配置文件的书签:")
            
            success_count = 0
            for profile in profiles:
                print(f"\n解析配置文件: {profile['display_name']}")
                if self.parse_bookmarks_from_file(profile['path'], profile['name']):
                    success_count += 1
            
            if success_count == 0:
                print("没有成功解析任何配置文件")
                return False
                
            print(f"\n成功解析了 {success_count} 个配置文件")
        else:
            # 解析单个配置文件
            if not self.parse_bookmarks_from_file(self.bookmarks_path):
                return False
        
        # 如果有第一层的网站链接，创建"我的常用"分类
        if self.my_favorites_sites:
            my_favorites = {
                'id': 'my-favorites',
                'name': '我的常用',
                'icon': '💥',
                'order': 0,
                'sites': self.my_favorites_sites
            }
            self.categories.insert(0, my_favorites)
            # 更新其他分类的order
            for i, category in enumerate(self.categories[1:], 1):
                category['order'] = i
        
        print(f"\n总计生成了 {len(self.categories)} 个分类")
        for category in self.categories:
            print(f"  - {category['name']}: {len(category['sites'])} 个网站")
        
        return True
    
    def generate_mock_data(self):
        """生成mock_data.js文件内容"""
        mock_data = {
            'categories': self.categories,
            'title': '宝拓导航'
        }
        
        # 生成JavaScript格式的内容
        js_content = f"export const mockData = {json.dumps(mock_data, ensure_ascii=False, indent=2)}\n"
        
        return js_content
    
    def save_mock_data(self, output_path="local_data.js"):
        """保存生成的mock数据到文件"""
        try:
            js_content = self.generate_mock_data()
            
            # 确保目录存在（只有当路径包含目录时才创建）
            dir_path = os.path.dirname(output_path)
            if dir_path:  # 只有当目录路径不为空时才创建
                os.makedirs(dir_path, exist_ok=True)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(js_content)
            
            print(f"成功生成 {output_path}")
            return True
            
        except Exception as e:
            print(f"保存文件时出错: {e}")
            return False


def main():
    """主函数"""
    print("=== Chrome书签转换工具 ===")
    print("正在扫描Chrome配置文件...")
    
    parser = ChromeBookmarkParser()
    
    # 查找并选择配置文件
    selected_path = parser.select_chrome_profile()
    
    if not selected_path:
        print("\n请确保：")
        print("1. Chrome浏览器已安装")
        print("2. 至少打开过一次Chrome并添加了书签")
        print("3. Chrome已完全关闭")
        return
    
    # 设置选择的路径
    parser.bookmarks_path = selected_path
    
    if selected_path == 'all':
        print("\n开始合并所有配置文件的书签...")
    else:
        print(f"\n开始读取书签文件: {selected_path}")
    
    # 解析书签
    if parser.parse_bookmarks():
        # 生成并保存mock数据
        if parser.save_mock_data():
            print("\n✅ 书签转换完成！")
            print("新的 local_data.js 文件已生成，包含了你的Chrome书签数据。")
            print("\n💡 提示：")
            print("- 生成的图标使用在线服务，确保网络连接")
        else:
            print("❌ 保存文件失败！")
    else:
        print("❌ 解析书签失败！")


if __name__ == "__main__":
    main()
