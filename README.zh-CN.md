# which-agents

查看仓库中某个文件实际受到哪些 `AGENTS.md` 指令约束。

这是一个零运行依赖的小型命令行工具，专门解决大型仓库中嵌套 `AGENTS.md`、`AGENTS.override.md`、优先级和内容上限难以排查的问题。它只读取本地文件，不联网，也不会修改仓库。

## 使用

需要 Node.js 18 或更高版本。

```bash
node which-agents.js src/api/user.ts
```

将包发布到 npm 后，也可以直接运行 `npx which-agents-md path/to/file`。

常用命令：

```bash
# 显示生效链
which-agents path/to/file

# 打印合并后的指令正文
which-agents --print path/to/file

# 输出 JSON，方便脚本或 CI 使用
which-agents --json path/to/file

# 不读取 ~/.codex 下的全局指令
which-agents --no-global path/to/file
```

## 判定顺序

工具从 Git 仓库根目录走到目标文件所在目录。每一层只选第一份非空文件：

1. `AGENTS.override.md`
2. `AGENTS.md`
3. 通过 `--fallback` 指定的自定义文件名

越接近目标文件的指令优先级越高。项目指令默认最多读取 32 KiB，可用 `--max-bytes` 修改。

## 发布

测试通过后，可以用 `v0.1.1` 标签创建 GitHub Release。

## 许可证

MIT
