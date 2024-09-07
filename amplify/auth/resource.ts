import { defineAuth } from '@aws-amplify/backend';
import { handleNewUser } from '../functions/handleNewUser/resource';
import { addUserToGroup } from "../functions/add-user-to-group/resource"
import { createGroup } from "../data/create-group/resource"
import { listUsers } from "../data/list-users/resource"
import { listGroupsForUser } from "../data/list-groups-for-user/resource"
import { removeUserFromGroup } from "../data/remove-user-from-group/resource"
/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */

export const auth = defineAuth({
  loginWith: {
    email: true,
  }, 
  userAttributes: {
    preferredUsername: {
      mutable: true,
      required: true
    }
  },
  groups: ["sysadmin", "orgadmin"],
  triggers:{postConfirmation: handleNewUser},
  access:(allow)=>[
    allow.resource(handleNewUser).to(["addUserToGroup","listUsers"]),
    allow.resource(createGroup).to(["createGroup"]),
    allow.resource(listUsers).to(["listUsers"]),
    allow.resource(listGroupsForUser).to(["listGroupsForUser"]),
    allow.resource(removeUserFromGroup).to(["removeUserFromGroup"]),
    allow.resource(addUserToGroup).to(["addUserToGroup"]),
  ]
});