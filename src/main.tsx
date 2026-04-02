import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import './index.css'

// React 17 降级渲染模式 - 用于诊断 Intel Mac 上的并发渲染问题
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)
