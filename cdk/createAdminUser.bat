CALL aws cognito-idp admin-create-user --user-pool-id %1 --username jjnaude --region eu-west-2 --user-attributes Name=email,Value=naude.jj@gmailcom --message-action SUPPRESS --temporary-password Password21#
CALL aws cognito-idp admin-add-user-to-group --region eu-west-2 --user-pool-id %1 --username jjnaude --group-name admin
CALL aws dynamodb update-item --table-name User-%2-NONE --key file://key.json --expression-attribute-names file://expression-attribute-names.json ^
    --expression-attribute-values file://expression-attribute-values.json --update-expression "SET #N = :n, #A = :a,#EM=:e,#U=:c,#C=:c" ^
    --expression-attribute-names file://expression-attribute-names.json ^
    --expression-attribute-values file://expression-attribute-values.json  