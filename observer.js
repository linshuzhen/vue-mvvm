class watcher{
  constructor(vm, expr, cb) {
    this.vm = vm
    this.expr = expr
    this.cb = cb
    // 先保存旧值 用于判断新值传入时 是否有变化
    this.oldVal = this.getOldVal()
  }
  getOldVal() {
    Dep.target = this
    const oldVal = compileUtil.getVal(this.expr, this.vm)
    // 在调用getVal时会触发observer中defineReactive中 object.defineProperty 中的get函数
    // 在get函数中拿到该watcher并添加到dep中
    Dep.target = null
    return oldVal
  }
  update() {
    const newVal = compileUtil.getVal(this.expr, this.vm)
    if (this.oldVal !== newVal) {
      this.oldVal = newVal
      this.cb(newVal)
    }
  }
}
class Dep{
  constructor() {
    this.subs = []
  }
  // 收集观察者
  addSub(watcher) {
    this.subs.push(watcher)
  }
  // 通知观察者去更新视图
  notify() {
    console.log(this.subs)
    this.subs.forEach(w => {
      w.update()
    })
  }
}
class Observer{
  constructor(data) {
    this.observe(data)
  }
  observe(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key])
      })
    }
  }
  defineReactive(obj, key, value) {
    // 递归遍历 value中是否还是对象
    this.observe(value)
    const dep = new Dep()
    // 劫持并监听所有的属性
    Object.defineProperty(obj, key, {
      enumerable: true, // 表示能否通过for-in循环返回属性
      configurable: false, // 表示能否通过delete删除属性从而重新定义属性
      get() {
        // 初始化 编译解析指令的时候 获取数据时就会调用get
        // 订阅数据变化时， 往dep中添加观察者 查看数据是否变化 更新对应视图
        // 观察者在 新建watcher的时候挂载到Dep上
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set:(newVal) => {
        // 对新值劫持 并进行监听
        this.observe(newVal)
        if (newVal !== value) {
          value = newVal
        }
        // 通知数据变化
        dep.notify()
      }
    }) 
  }
}