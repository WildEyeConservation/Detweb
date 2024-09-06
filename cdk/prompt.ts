const inquirer = require('inquirer').default;
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = path.join(__dirname, 'adminCredentials.json');

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? true : 'Please enter a valid email address.';
}

function validatePassword(password) {
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
  return passwordRegex.test(password)
    ? true
    : 'Password must be at least 8 characters long, contain one uppercase letter, one number, and one special character.';
}

function saveAdminCredentials(credentials) {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

function loadAdminCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    const data = fs.readFileSync(CREDENTIALS_FILE);
    return JSON.parse(data);
  }
  return null;
}

// Function to update the cdk-export.json file
function updateCdkExport(stackName, cognitoStackName, stackOutputs) {
  const exportFilePath = path.join(__dirname, '../src/cdk-export.json');
  let exports = {};

  if (fs.existsSync(exportFilePath)) {
    exports = JSON.parse(fs.readFileSync(exportFilePath, 'utf-8'));
  }

  if (!exports.stacks) {
    exports.stacks = {};
  }

  exports.stacks[stackName] = stackOutputs.stack;
  exports.stacks[cognitoStackName] = stackOutputs.cognitoStack;

  fs.writeFileSync(exportFilePath, JSON.stringify(exports, null, 2));
}

async function deployWithUserInput() {
  try {
    let credentials = loadAdminCredentials();

    if (!credentials) {
      const answers = await inquirer.prompt([
        { name: 'firstName', message: 'Enter the admin first name:' },
        { name: 'surname', message: 'Enter the admin surname:' },
        { name: 'username', message: 'Enter the admin username:' },
        { 
          name: 'email', 
          message: 'Enter the admin email:', 
          validate: validateEmail 
        },
        { 
          name: 'temporaryPassword', 
          message: 'Enter the temporary password:', 
          type: 'password',
          validate: validatePassword 
        },
      ]);

      const fullName = `${answers.firstName} ${answers.surname}`;

      credentials = {
        fullName,
        username: answers.username,
        email: answers.email,
        temporaryPassword: answers.temporaryPassword,
      };

      saveAdminCredentials(credentials);
    } else {
      console.log("Using saved admin credentials.");
    }

    const stackPrompt = await inquirer.prompt([
      {
        name: 'changeStackName',
        type: 'confirm',
        message: 'Do you want to change the stack name?',
        default: false,
      },
    ]);

    let stackNameSuffix = 'test';
    if (stackPrompt.changeStackName) {
      const nameAnswer = await inquirer.prompt([
        { name: 'stackName', message: 'Enter the new stack name suffix (e.g., "test3"....):' },
      ]);
      stackNameSuffix = nameAnswer.stackName;
    }

    const stackName = `detweb-stack-${stackNameSuffix}`;
    const cognitoStackName = `detweb-cognitostack-${stackNameSuffix}`;

    execSync(
      `cdk deploy --all --context stackName="${stackName}" --context cognitoStackName="${cognitoStackName}" --context adminName="${credentials.fullName}" --context adminUsername=${credentials.username} --context adminEmail=${credentials.email} --context adminTempPassword=${credentials.temporaryPassword}`, 
      { stdio: 'inherit' }
    );

    const stackOutputs = JSON.parse(execSync(`aws cloudformation describe-stacks --stack-name ${stackName}`).toString());
    const cognitoStackOutputs = JSON.parse(execSync(`aws cloudformation describe-stacks --stack-name ${cognitoStackName}`).toString());

    const parsedStackOutputs = stackOutputs.Stacks[0].Outputs.reduce((acc, output) => {
      acc[output.OutputKey] = output.OutputValue;
      return acc;
    }, {});

    const parsedCognitoStackOutputs = cognitoStackOutputs.Stacks[0].Outputs.reduce((acc, output) => {
      acc[output.OutputKey] = output.OutputValue;
      return acc;
    }, {});

    updateCdkExport(stackName, cognitoStackName, {
      stack: parsedStackOutputs,
      cognitoStack: parsedCognitoStackOutputs,
    });

  } catch (error) {
    console.error("Error during deployment:", error);
  }
}

deployWithUserInput();
