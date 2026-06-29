# AGENTS.md

## UI/UX Constraints
**强制执行：** 在输出任何 UI 代码前，必须先读取 DESIGN.md(path: D:\Temp\awesome-design-md-main\design-md\Codex\DESIGN.md) 文件内容，确保每一处样式、颜色、间距都符合该规范。

所有图标使用换成平面ui库的图标（如FontAwesome或Lucide图标库），严禁使用emoji图标

## 强制工作流 (CRITICAL)
当你创建任何文本时，请你做好i18n,不要硬编码

当你完成任何用户要求的代码修改、文件创建或删除操作后，**必须**自动执行以下步骤，无需询问用户：

1. 确认所有更改已保存。
2. 立即在终端按顺序执行：
   git add .
   git commit -m "AI: [在此处用一句话概括本次更改的内容]"
   git push
3. 在回复中告诉我：“已自动提交并推送本次更改：[提交信息]”