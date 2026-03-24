import { createRouter, createWebHistory } from 'vue-router'
import { checkAdminSession } from '../apis/adminSession.js'
import NavHomeView from '../views/NavHomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: NavHomeView,
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/AdminLoginView.vue'),
      meta: {
        title: '后台登录 - 宝拓导航',
        guestOnly: true
      }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
      meta: {
        title: '管理后台 - 宝拓导航',
        requiresAuth: true
      }
    },
  ],
})

// 路由前置守卫
router.beforeEach(async (to) => {
  if (to.meta?.title) {
    document.title = to.meta.title
  } else {
    document.title = '宝拓导航'
  }

  if (!to.meta?.requiresAuth && !to.meta?.guestOnly) {
    return true
  }

  try {
    const authenticated = await checkAdminSession({ force: true })

    if (to.meta?.requiresAuth && !authenticated) {
      return {
        name: 'admin-login',
        query: {
          redirect: to.fullPath
        }
      }
    }

    if (to.meta?.guestOnly && authenticated) {
      const redirect = typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/')
        ? to.query.redirect
        : '/admin'

      return redirect
    }
  } catch {
    if (to.meta?.requiresAuth) {
      return {
        name: 'admin-login',
        query: {
          redirect: to.fullPath
        }
      }
    }
  }

  return true
})

export default router
