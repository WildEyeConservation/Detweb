![WildEye Logo](public/WildEyeLogo.png)

# SurveyScope: AI Aerial-Census Software

## Overview
SurveyScope is a powerful web application that leverages the latest artificial intelligence (AI) to assist in the annotation of aerial-census data – by detecting and identifying the animals contained therein. This is regardless of:

- Data source – whether it's our SkySeeker camera pod, a drone or anything else.
- Camera angle – from nadir to oblique.
- Region – from Cape Agulhas to the horn of Africa, and all the continents of the world.
- Species – everything from baboons and warthogs all the way up to elephants.
- Technique – from sample counts to full counts.

## Who
This repo is maintained by [WildEye Conservation](https://wildeyeconservation.org/) - an organisation dedicated to using technology, and machine vision in particular, to further the conservation and protection of wildlife.

## Things to watch out for

### 1. AWS Region Service Limitations
Not all AWS regions support all services, or support all services fully. Usually you only discover this once you have invested significant time into developing some new feature that requires X. eg. 
- af-south-1 does not support amplify (I assume this just means amplify hosting, because the backend is built on cdk, which is built on cloudformation both of which obviously work just fine and the frontend is built on your machine and can be hosted anywhere).
- af-south-1 does not support aurora serverless (or more precisley they just don't have any serverless engines available for aurora-mysql)
- af south has g4dn instances in 2 of the three AZs. If you don't hack your way around this, then the deployment fails, because CDK tries to place g4dn where they are not available.

### 2. Region Change Bug
Changing regions triggers the following bug:
https://github.com/aws/aws-cdk/issues/26446.
Workaround is to clear docker cache.

### 3. Node.js Socket Timeout
Sometimes npx ampx would fail to use local sso credentials, hidden in the error message was something about a socket timeout. This ultimately led me to 
https://stackoverflow.com/questions/76179568/socket-connection-timout-error-in-node-js and an upgrade to 20.17.0 did indeed solve the problem.

### 4. Docker Credential Store Issue
Docker credential store is unable to deal with the long strings that ECR uses for auth.
This can be solved by opening ~\.docker\config.json and deleting the line 
"credsStore": "desktop",
This one tends to recur. I suspect that docker desktop restores that file to previous status.

### 5. Amplify ECR Authentication
Amplify does not correctly refresh the credentials for pushing images to ecr with docker (at 
least not on windows). This affects deploys that try to push new images to the sandbox environment.
You'll get an error similar to:

```
amplify-amplifyvitereacttemplate-naude-sandbox-86256f2328: fail: docker push 275736403632.dkr.ecr.af-south-1.amazonaws.com/cdk-hnb659fds-container-assets-275736403632-af-south-1:986890dc61c207efc47fcd6460813d114cf054971c343c4a87443559ed7b2239 exited with error code 1: denied: Your authorization token has expired. Reauthenticate and try again.    
Failed to publish asset 986890dc61c207efc47fcd6460813d114cf054971c343c4a87443559ed7b2239:current_account-current_regio
```

You can manually fix this by running:
```bash
aws ecr get-login-password --region eu-west-2 | docker login --username AWS --password-stdin 275736403632.dkr.ecr.eu-west-2.amazonaws.com
```

Replace "275736403632" with your account number and both occurrences of eu-west-2 with your region.

### 6. API Field Undefined Error
Writing this up as it has now happened twice. Sometimes API calls would "randomly" start failing with the following error reported in the browser console:

```
Cannot destructure property 'isReadOnly' of 'fields7[fieldName]' as it is undefined.
```

This is not very informative, but it usually means that your client.models.SomeModel.someAction call is referring to a field that does not exist. If you checked against the schema, and everything seems correct, then the likely cause is simply that your amplify_outputs.json file is out of date. If you are testing against the production backend, then just make sure your latest schema is deployed in production, download the latest amplify_outputs.json from the aws amplify dashboard and place it in the project folder. If you are testing in your sandbox, you just need to make sure npx ampx sandbox has completed succesfully against your latest backend definition.
