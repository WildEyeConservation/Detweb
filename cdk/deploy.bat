CALL cdk synth --all
CALL python fixup.py
CALL cdk deploy -vv --app 'cdk.out/' detweb-stack-test
