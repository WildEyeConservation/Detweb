import {useState, useEffect} from 'react';
import { Schema } from './amplify/client-schema'; // Path to your backend resource definition
import { useContext } from 'react';
import { GlobalContext } from './Context';

export const useUsers = () => {
  const {client} = useContext(GlobalContext)!;
  let [result, setResult] = useState<Schema['UserType']['type'][]>([]);
  useEffect(() => {
    client.queries.listUsers({}).then(({ data }) => {
      // Spent some time looking at this bug. Looks like the type does not flow correctly and typescript cannot see that the data is of type Schema['UserType']['type'][]
      // data.Users is guaranteed to be an array type (even though it is in practice). I suspect this has something to do with the outer layer
      // RefType<someType,"array",undefined>. Next step is probably to ask on Discord as I am unable to find any detailed docs on this topic. JJN.

      if (data?.Users) setResult(data.Users as Schema['UserType']['type'][]);
    });
  }, [client.queries]);
  return { users: result };
};
