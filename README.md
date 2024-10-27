Things to watch out for

Not all AWS regions support all services, or support all services fully. Usually you only discover this once you have invested significant time into developing some new feature that requires X. eg. 
- af-south-1 does not support amplify (I assume this just means amplify hosting, because the backend is built on cdk, which is built on cloudformation both of which obviously work just fine and the frontend is built on your machine and can be hosted anywhere).
- af-south-1 does not support aurora serverless (or more precisley they just don't have any serverless engines available for aurora-mysql)
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

Amplify does not correctly refresh the credentials for pushing images to ecr with docker (at 
least not on windows). This affects deploys that try to push new images to the sandbox environment.
You'll get an error similat to:

amplify-amplifyvitereacttemplate-naude-sandbox-86256f2328: fail: docker push 275736403632.dkr.ecr.af-south-1.amazonaws.com/cdk-hnb659fds-container-assets-275736403632-af-south-1:986890dc61c207efc47fcd6460813d114cf054971c343c4a87443559ed7b2239 exited with error code 1: denied: Your authorization token has expired. Reauthenticate and try again.    
Failed to publish asset 986890dc61c207efc47fcd6460813d114cf054971c343c4a87443559ed7b2239:current_account-current_regio

You can manually fix this by running:
aws ecr get-login-password --region af-south-1 | docker login --username AWS --password-stdin 275736403632.dkr.ecr.af-south-1.amazonaws.com

Replace 275736403632 with your account number and both occurrences of af-south-1 with your region.

