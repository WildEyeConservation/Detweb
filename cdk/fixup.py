import json
with open('.\\cdk.out\\detweb-stack-test.template.json','r') as f:
    stck=json.load(f)
key=next(iter(filter(lambda key:key.startswith('detwebAPIGraphQLAPI'),stck['Resources'].keys())))
stck['Resources'][key]['Properties']['UserPoolConfig']['AwsRegion']='eu-west-2'
with open('.\\cdk.out\\detweb-stack-test.template.json','w') as f:
    json.dump(stck,f,indent=4)


