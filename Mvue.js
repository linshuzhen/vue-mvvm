const compileUtil = {
  getVal(expr, vm) {
    // [person, name]
    return expr.split('.').reduce((data, currentVal) => {
      // console.log(currentVal)
      return data[currentVal]
    }, vm.$data)
  },
  setVal(expr, vm, inputVal) {
    // 视图=>数据=>视图 修改data中的数据 并在observe的set函数中 通知变化 更新视图
    expr.split('.').reduce((data, currentVal, index, arr) => {
      if(index === arr.length-1){ 
        data[currentVal] = inputVal
      }
      return data[currentVal]
    }, vm.$data)
  },
  getContentVal(expr, vm) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(args[1], vm)
    })
  },
  text(node, expr, vm) {
    let value
    if (expr.indexOf('{{') !== -1) {
      // 处理 存在双大括号的文本 {{personalbar.name}} {{msg}}
      value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        // replace 替换回调函数参数分别有：0 匹配到的字符串 1在使用组匹配 组匹配到的值 匹配值在原字符串中的索引 原字符串 
        // 绑定观察者 将来数据发生变化 触发这里的回调 进行更新
        new watcher(vm, args[1], (newVal) => {
          // console.log('newVal', newVal, this.getContentVal(expr, vm))
          // 在此有个疑问 newVal和getContentVal重新解析原表达式获取的值是一样的 不知作者为啥要重新解析一遍?
          this.updater.textUpdater(node, this.getContentVal(expr, vm))
        })
        return this.getVal(args[1], vm)
      })
    } else {
      // 处理v-text expr: msg vm: 整个实例
      new watcher(vm, expr, (newVal) => {
        this.updater.textUpdater(node, newVal)
      })
      value = this.getVal(expr, vm)
    }
    this.updater.textUpdater(node, value)
  },
  html(node, expr, vm) {
    const value = this.getVal(expr, vm)
    new watcher(vm, expr, (newVal) => {
      this.updater.htmlUpdater(node, newVal)
    })
    this.updater.htmlUpdater(node, value)
  },
  model(node, expr, vm) {
    const value = this.getVal(expr, vm)
    // 创建监听者 并通过watcher中的update来绑定回调这个更新函数  数据 =》 视图
    new watcher(vm, expr, (newVal) => {
      this.updater.modelUpdater(node, newVal)
    })
    // 视图 =》 数据 =》 视图
    node.addEventListener('input', (e) => {
      // 设置值
      this.setVal(expr, vm, e.target.value)
    })
    this.updater.modelUpdater(node, value)
  },
  on(node, expr, vm, eventName) {
    // 找到对应的函数方法 绑定监听函数
    let fn = vm.$options.methods && vm.$options.methods[expr]
    // 修改函数this指向为当前vue实例
    node.addEventListener(eventName, fn.bind(vm), false)
  },
  bind(node, expr, vm, attrName) {
    const value = this.getVal(expr, vm)
    this.updater.bindUpdater(node, attrName, value)
  },
  // 更新函数
  updater: {
    textUpdater(node, value) {
      node.textContent = value
    },
    htmlUpdater(node, value) {
      node.innerHTML = value
    },
    modelUpdater(node, value) {
      node.value = value
    },
    bindUpdater(node, attrName, value) {
      node.setAttribute(attrName, value)
    }
  }
}
class Compile{
  constructor(el, vm) {
    // 判断el是否是一个元素节点对象
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    // 1 获取文档碎片对象 放入内存中 减少页面的回流和重绘
    const fragement = this.node2Fragment(this.el)
    // 2 编译模板 
    this.compile(fragement)
    // 3 追加子元素到根元素上
    this.el.appendChild(fragement)
  }
  compile(fragement) {
    // 1 获取所有子节点
    let childNodes = fragement.childNodes
    childNodes = [...childNodes]
    childNodes.forEach(child => {
      if (this.isElementNode(child)) {
        // 是元素节点
        // 编译元素节点
        // console.log('元素节点', child)
        this.compileElement(child)
      } else {
        // console.log('文本节点', child)
        // 编译文本节点
        this.compileText(child)
      }
      if (child.childNodes && child.childNodes.length) {
        this.compile(child)
      }
    })
  }
  compileElement(node){
    // 元素节点  v-html v-model v-text等指令或者事件绑定
    let attributes = node.attributes
    attributes = [...attributes]
    // 拿到所有的属性 解析出指令
    attributes.forEach(attr => {
      const {name, value} = attr // 例如：v-text msg
      // console.log(attr, name, value)
      if (this.isDirective(name)) {
        // 判断是否是v-开始  表示是一个指令 v-text v-html v-model v-on:click
        const [, dirctive] = name.split('-') // text html model on:click
        const [dirName, eventName] = dirctive.split(':') // dirName: text html model on eventName: click
        // 更新数据 数据驱动视图
        compileUtil[dirName](node, value, this.vm, eventName)

        // 删除带有指令标签的属性
        node.removeAttribute('v-'+dirctive)
      } else if (this.isEventName(name)) {
        // @click="handleClick"
        let [,eventName] = name.split('@')
        compileUtil['on'](node, value, this.vm, eventName)
        // 删除带有@的属性
        node.removeAttribute('@'+eventName)
      } else if (this.isBindName(name)) {
        let [, attrName] = name.split(':')
        compileUtil['bind'](node, value, this.vm, attrName)
        // 删除带有:的属性
        node.removeAttribute(':'+attrName)
      }
    })
  }

  compileText(node) {
    // {{}} 对应类似v-text
    const content = node.textContent
    if (/\{\{(.+?)\}\}/.test(content)) {
      // 正则匹配含有双大括号的文本 并且
      // console.log(content)
      compileUtil['text'](node, content, this.vm)
    }
  }
  isBindName(attrName) {
    return attrName.startsWith(':')
  }
  isEventName(attrName) {
    return attrName.startsWith('@')
  }
  isDirective(attrName) {
    return attrName.startsWith('v-')
  }
  isElementNode(node) {
    // 原生判断nodeType是否等于1  
    return node.nodeType === 1
  }
  node2Fragment(el) {
    // 创建文档碎片
    const f = document.createDocumentFragment()
    let firstChild;
    // appendChild具有可移动性 是将el中的节点移动到了fragment当中
    while(firstChild = el.firstChild) {
      f.appendChild(firstChild)
    } 
    return f
  }
}

class MVue{
  constructor(options) {
    this.$el = options.el
    this.$data = options.data
    this.$options = options
    if (this.$el) {
      // 1 实现一个Observe
      new Observer(this.$data)
      // 2 实现一个解析器 初始化数据 渲染页面
      new Compile(this.$el, this)
      this.proxyData(this.$data)
    }
  }
  proxyData(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newVal) {
         data[key] = newVal
        }
      })
    }
  }
}
