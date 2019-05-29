const fs = require('fs')
const path = require('path')
const babel = require('@babel/core')
const babelParser = require('@babel/parser')
const babelTraverse = require('@babel/traverse').default

const moduleAnalyser = (filename) => {
  const content = fs.readFileSync(filename, 'utf8')
  
  // 将源代码解析为ast抽象语法树
  const ast = babelParser.parse(content, {
    sourceType: 'module'
  })

  // 获取源代码中 通过import导入的依赖文件路径
  const dependencies = {}
  babelTraverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename)
      dependencies[node.source.value] = './' + path.join(dirname, node.source.value)
    }
  })

  // 通过@babel/core 将源代码转换为ES5代码
  const { code } = babel.transformFromAst(ast, null, {
    presets: [
      '@babel/preset-env'
    ]
  })

  return {
    filename,
    code,
    dependencies
  }
}


// 从入口开始 对依赖进行分析
function makeDependenciesGraph(entry) {
  const chunk = moduleAnalyser(entry)
  let graphArray = [chunk]
  for (let i = 0; i < graphArray.length; i++) {
    let { dependencies } = graphArray[i]
    if (dependencies) {
      for (let k in dependencies) {
        graphArray.push(moduleAnalyser(dependencies[k]))
      }
    }
  }

  // 结构格式化 
  // graph = {
  //   './src/index.js': {
  //     dependencies,
  //     code
  //   }
  // }
  const graph = {}
  graphArray.forEach(item => {
    graph[item.filename] = {
      dependencies: item.dependencies,
      code: item.code
    }
  })
  return graph
}


function generatorCode(entry) {
  const graph = JSON.stringify(makeDependenciesGraph(entry))
  return `
    ;(function(graph) {

     function require(module) {
       function localRequire(relativePath) {
         return require(graph[module].dependencies[relativePath])
       }
       var exports = {}
       ;(function(require, exports, code) {
         eval(code)
       })(localRequire, exports, graph[module].code)
       return exports
     }
     require('${entry}')
    })(${graph})
  `
}

const code = generatorCode('./src/index.js')

// 放到浏览器环境之下执行最终编译code 输出 “hello Brolly”
console.log(code)