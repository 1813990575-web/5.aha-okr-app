/**
 * 数据库种子数据
 * 创建丰富的示例目录结构
 */

import { createItem, getAllItems } from './models'
import type { CreateItemRequest } from './models'

/**
 * 丰富的示例数据
 * 包含多个目标、关键结果和 TODO
 */
const seedData: CreateItemRequest[] = [
  // ========== 目标 1: 发布 vibe coding 视频 ==========
  {
    id: 'obj-1',
    type: 'O',
    parent_id: null,
    title: '发布 vibe coding 视频',
    content: '制作并发布一系列关于 vibe coding 的教学视频',
    status: 0,
    sort_order: 1,
  },
  // 目标 1 下的 KR1
  {
    id: 'kr-1-1',
    type: 'KR',
    parent_id: 'obj-1',
    title: '完成 3 个应用场景演示',
    content: '',
    status: 0,
    sort_order: 1,
  },
  // KR1 下的 TODO
  {
    id: 'todo-1-1-1',
    type: 'TODO',
    parent_id: 'kr-1-1',
    title: '应用 1: 待办事项应用',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-1-1-2',
    type: 'TODO',
    parent_id: 'kr-1-1',
    title: '应用 2: 天气查询应用',
    content: '',
    status: 0,
    sort_order: 2,
  },
  {
    id: 'todo-1-1-3',
    type: 'TODO',
    parent_id: 'kr-1-1',
    title: '应用 3: 笔记管理应用',
    content: '',
    status: 0,
    sort_order: 3,
  },
  // 目标 1 下的 KR2
  {
    id: 'kr-1-2',
    type: 'KR',
    parent_id: 'obj-1',
    title: '视频制作完成度达到 100%',
    content: '',
    status: 0,
    sort_order: 2,
  },
  // KR2 下的 TODO
  {
    id: 'todo-1-2-1',
    type: 'TODO',
    parent_id: 'kr-1-2',
    title: '录制视频素材',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-1-2-2',
    type: 'TODO',
    parent_id: 'kr-1-2',
    title: '剪辑和后期制作',
    content: '',
    status: 0,
    sort_order: 2,
  },
  {
    id: 'todo-1-2-3',
    type: 'TODO',
    parent_id: 'kr-1-2',
    title: '上传 git',
    content: '',
    status: 0,
    sort_order: 3,
  },
  // 目标 1 下的 KR3
  {
    id: 'kr-1-3',
    type: 'KR',
    parent_id: 'obj-1',
    title: '获得 1000 次观看',
    content: '',
    status: 0,
    sort_order: 3,
  },

  // ========== 目标 2: vibe coding 上线 ==========
  {
    id: 'obj-2',
    type: 'O',
    parent_id: null,
    title: 'vibe coding 上线',
    content: '将 vibe coding 平台正式上线运营',
    status: 0,
    sort_order: 2,
  },
  // 目标 2 下的 KR1
  {
    id: 'kr-2-1',
    type: 'KR',
    parent_id: 'obj-2',
    title: '完成核心功能开发',
    content: '',
    status: 0,
    sort_order: 1,
  },
  // KR1 下的 TODO
  {
    id: 'todo-2-1-1',
    type: 'TODO',
    parent_id: 'kr-2-1',
    title: '用户认证系统',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-2-1-2',
    type: 'TODO',
    parent_id: 'kr-2-1',
    title: '代码编辑器集成',
    content: '',
    status: 0,
    sort_order: 2,
  },
  {
    id: 'todo-2-1-3',
    type: 'TODO',
    parent_id: 'kr-2-1',
    title: '项目部署功能',
    content: '',
    status: 0,
    sort_order: 3,
  },
  // 目标 2 下的 KR2
  {
    id: 'kr-2-2',
    type: 'KR',
    parent_id: 'obj-2',
    title: '通过测试验收',
    content: '',
    status: 0,
    sort_order: 2,
  },
  // KR2 下的 TODO
  {
    id: 'todo-2-2-1',
    type: 'TODO',
    parent_id: 'kr-2-2',
    title: '单元测试覆盖 80%',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-2-2-2',
    type: 'TODO',
    parent_id: 'kr-2-2',
    title: '集成测试',
    content: '',
    status: 0,
    sort_order: 2,
  },
  // 目标 2 下的 KR3
  {
    id: 'kr-2-3',
    type: 'KR',
    parent_id: 'obj-2',
    title: '准备上线文档',
    content: '',
    status: 0,
    sort_order: 3,
  },
  // KR3 下的 TODO
  {
    id: 'todo-2-3-1',
    type: 'TODO',
    parent_id: 'kr-2-3',
    title: '用户手册',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-2-3-2',
    type: 'TODO',
    parent_id: 'kr-2-3',
    title: 'API 文档',
    content: '',
    status: 0,
    sort_order: 2,
  },

  // ========== 目标 3: 学习新技术栈 ==========
  {
    id: 'obj-3',
    type: 'O',
    parent_id: null,
    title: '学习新技术栈',
    content: '掌握最新的前端技术栈',
    status: 0,
    sort_order: 3,
  },
  // 目标 3 下的 KR1
  {
    id: 'kr-3-1',
    type: 'KR',
    parent_id: 'obj-3',
    title: '完成 React 进阶课程',
    content: '',
    status: 0,
    sort_order: 1,
  },
  // KR1 下的 TODO
  {
    id: 'todo-3-1-1',
    type: 'TODO',
    parent_id: 'kr-3-1',
    title: 'Hooks 深入学习',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-3-1-2',
    type: 'TODO',
    parent_id: 'kr-3-1',
    title: '性能优化技巧',
    content: '',
    status: 0,
    sort_order: 2,
  },
  // 目标 3 下的 KR2
  {
    id: 'kr-3-2',
    type: 'KR',
    parent_id: 'obj-3',
    title: '掌握 TypeScript 高级特性',
    content: '',
    status: 0,
    sort_order: 2,
  },
  // KR2 下的 TODO
  {
    id: 'todo-3-2-1',
    type: 'TODO',
    parent_id: 'kr-3-2',
    title: '泛型编程',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-3-2-2',
    type: 'TODO',
    parent_id: 'kr-3-2',
    title: '类型体操',
    content: '',
    status: 0,
    sort_order: 2,
  },
  // 目标 3 下的 KR3
  {
    id: 'kr-3-3',
    type: 'KR',
    parent_id: 'obj-3',
    title: '学习 Electron 开发',
    content: '',
    status: 0,
    sort_order: 3,
  },
  // KR3 下的 TODO
  {
    id: 'todo-3-3-1',
    type: 'TODO',
    parent_id: 'kr-3-3',
    title: '主进程与渲染进程通信',
    content: '',
    status: 0,
    sort_order: 1,
  },
  {
    id: 'todo-3-3-2',
    type: 'TODO',
    parent_id: 'kr-3-3',
    title: '原生模块集成',
    content: '',
    status: 0,
    sort_order: 2,
  },
]

/**
 * 检查数据库是否已有数据
 */
export async function hasExistingData(): Promise<boolean> {
  const items = await getAllItems()
  return items.length > 0
}

/**
 * 初始化种子数据
 * 仅在数据库为空时执行
 */
export async function seedDatabase(): Promise<void> {
  const hasData = await hasExistingData()
  if (hasData) {
    console.log('[Database] 数据库已有数据，跳过种子数据初始化')
    return
  }

  console.log('[Database] 开始初始化种子数据...')

  for (const item of seedData) {
    try {
      await createItem(item)
      console.log(`[Database] 已创建: ${item.type} - ${item.title}`)
    } catch (error) {
      console.error(`[Database] 创建失败: ${item.title}`, error)
    }
  }

  console.log('[Database] 种子数据初始化完成')
}

/**
 * 强制重新初始化种子数据
 * 警告：会清空现有数据
 */
export async function reseedDatabase(): Promise<void> {
  const { clearAllItems } = await import('./models')
  await clearAllItems()
  await seedDatabase()
}

/**
 * 添加更多示例数据（不清空现有数据）
 */
export async function addMoreSampleData(): Promise<void> {
  console.log('[Database] 添加更多示例数据...')
  
  // 这里可以添加额外的示例数据
  // 如果需要清空并重新创建，请使用 reseedDatabase()
}
