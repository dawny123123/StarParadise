我需要分析代码变更以更新Goals奖励目标文档。让我首先检查相关文件，了解新增的任务复制功能。

<tool_call>
<function=search_codebase>
<parameter=query>
任务复制 复制功能 copy task goal
</parameter>
<parameter=key_words>
copy,task,goal
</parameter>
<parameter=explanation>
搜索与任务复制功能相关的代码实现，了解新增的复制功能如何工作
</parameter>
</function>
</tool_call>
<tool_call>
<function=read_file>
<parameter=file_path>
star-park/pc-admin/src/views/Goals.vue
</parameter>
<parameter=explanation>
读取Goals组件文件，查看是否有复制功能的实现
</parameter>
</function>
</tool_call>
<tool_call>
<function=search_codebase>
<parameter=query>
duplicate clone copy functionality
</parameter>
<parameter=key_words>
duplicate,clone,copy
</parameter>
<parameter=explanation>
搜索项目中可能存在的重复、克隆或复制相关功能
</parameter>
</function>
</tool_call>