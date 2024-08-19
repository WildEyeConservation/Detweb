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

    execSync(
      `cdk deploy --all --context adminName="${credentials.fullName}" --context adminUsername=${credentials.username} --context adminEmail=${credentials.email} --context adminTempPassword=${credentials.temporaryPassword}`, 
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error("Error during deployment:", error);
  }
}

deployWithUserInput();
