import os, subprocess
vars = ['QODERWAKE_AT_WAKER_MCP_TOKEN','QODERWAKE_BUILTIN_MEMORY_MCP_TOKEN','QODERWAKE_BUILTIN_DINGTALK_DWS_MCP_TOKEN','QODERWAKE_BUILTIN_IM_CHAT_HISTORY_MCP_TOKEN','QODERWAKE_BUILTIN_BROWSER_MCP_TOKEN','QODERWAKE_BUILTIN_MICROSOFT365_MCP_TOKEN','QODERWAKE_BUILTIN_QMIND_MCP_TOKEN','QODERWAKE_BUILTIN_QA_RECORD_MCP_TOKEN','QODERWAKE_USER_MCP_CREDENTIAL_3B6674D5A5A99E227E4CB5D4','QODERWAKE_USER_MCP_CREDENTIAL_4E604976F523459D7354699E','QODERWAKE_USER_MCP_CREDENTIAL_CA28E8AF1A6967874C430F1E','QODERWAKE_USER_MCP_CREDENTIAL_9EA25157149794CF654FAC6B']
cond = '{"conditionGroups":[[{"fieldIdentifier":"subject","operator":"CONTAINS","value":["PONR-5"],"className":"string","format":"input"}]]}'
for v in vars:
    tok = os.environ.get(v)
    if not tok:
        continue
    env = os.environ.copy()
    env['ALIBABA_CLOUD_YUNXIAO_ACCESS_TOKEN'] = tok
    try:
        r = subprocess.run(['aliyun','devops','projex-search-workitems','--category','Req','--space-id','1d2be88132d1ff30e96c1275c0','--conditions',cond], env=env, capture_output=True, text=True, timeout=20)
        out = r.stdout + r.stderr
        if 'PONR-5' in out or 'workitem' in out.lower() or 'subject' in out.lower():
            print('SUCCESS with', v)
            print(out[:500])
            break
    except Exception as e:
        print('err', v, e)
