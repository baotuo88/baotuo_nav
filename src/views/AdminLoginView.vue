<template>
  <div class="admin-login-page">
    <div class="login-box">
      <h1>🔐 宝拓导航后台</h1>
      <p class="login-copy">后台管理入口已启用服务端会话验证。</p>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="password">管理密钥:</label>
          <input
            id="password"
            v-model="loginPassword"
            type="password"
            placeholder="请输入管理密钥"
            required
            class="form-input"
          />
        </div>
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '验证中...' : '登录后台' }}
        </button>
      </form>

      <div v-if="loginError" class="error-message">
        {{ loginError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGitHubAPI } from '../apis/useGitHubAPI.js'
import { setAdminSessionAuthenticated } from '../apis/adminSession.js'

const router = useRouter()
const route = useRoute()
const { loginAdmin } = useGitHubAPI()

const loginPassword = ref('')
const loginError = ref('')
const loading = ref(false)

const redirectTarget = computed(() => {
  if (typeof route.query.redirect !== 'string') {
    return '/admin'
  }

  return route.query.redirect.startsWith('/') ? route.query.redirect : '/admin'
})

if (route.query.reason === 'expired') {
  loginError.value = '登录状态已失效，请重新输入管理密钥。'
}

const handleLogin = async () => {
  loading.value = true
  loginError.value = ''

  try {
    await loginAdmin(loginPassword.value)
    setAdminSessionAuthenticated(true)
    loginPassword.value = ''
    await router.replace(redirectTarget.value)
  } catch (error) {
    loginError.value = error.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.admin-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(circle at top left, rgba(45, 212, 191, 0.12), transparent 18%),
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 22%),
    #10263a;
}

.login-box {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  border-radius: 20px;
  border: 1px solid rgba(245, 158, 11, 0.14);
  background: rgba(255, 250, 241, 0.96);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.28);
}

.login-box h1 {
  margin: 0 0 10px;
  text-align: center;
  color: #10263a;
  font-size: 24px;
}

.login-copy {
  margin: 0 0 28px;
  text-align: center;
  color: #5e7383;
  font-size: 14px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e1e1;
  border-radius: 10px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #10263a;
}

.login-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: #10263a;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.login-btn:hover:not(:disabled) {
  background: #0d3148;
}

.login-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 10px;
  background: #ffebee;
  color: #c62828;
  text-align: center;
  font-size: 14px;
}
</style>
