Things to watch out for

Not all AWS regions support all services, or support all services fully. Usually you only discover this once you have invested significant time into developing some new feature that requires X. eg. 
- af-south-1 does not support amplify (I assume this just means amplify hosting, because the backend is built on cdk, which is built on cloudformation both of which obviously work just fine and the frontend is built on your machine and can be hosted anywhere).
- af-south-1 does not support aurora serverless (or more precisley they just don;t have any serverless engines available for aurora-mysql)
- af south has g4dn instances in 2 of the three AZs. If you don't hack your way around this, then the deployment fails, because CDK tries to place g4dn where they are not available.

Changing regions triggers the following bug:
https://github.com/aws/aws-cdk/issues/26446
Workaround is to clear docker cache.

sometimes npx ampx would fail to use local sso credentials, hidden in the error message was something about a socket timeout. This ultimately led me to 
https://stackoverflow.com/questions/76179568/socket-connection-timout-error-in-node-js and an upgrade to 20.17.0 did indeed solve the problem.

Docker credential store is unable to deal with the long strings that ECR uses for auth.
This can be solved by opening ~\.docker\config.json and deleting the line 
"credsStore": "desktop",
This one tends to recur. I suspect that docket desktop restores that file to previous status.

