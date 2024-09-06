import { defineFunction } from '@aws-amplify/backend';

export const addUser = defineFunction({
    name: 'addUser',
    environment:{
        GROUP: 'annotator'
    }
});