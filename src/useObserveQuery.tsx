import { Schema } from './amplify/client-schema';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from './Context';
import { V6Client } from '@aws-amplify/api-graphql';

type ClientType = V6Client<Schema>;
type ModelType = keyof ClientType['models'];

export function useObserveQuery<T extends ModelType>(
  modelName: T,
  filter?: any
) {
  const { client } = useContext(GlobalContext)!;
  const model = client.models[modelName];
  type ResultType = {
    items: Schema[T]['type'][];
    isSynced: boolean;
  };
  const [result, setResult] = useState<ResultType>({
    items: [],
    isSynced: false,
  });

  useEffect(() => {
    console.log('useObserveQuery', modelName, filter);
    const sub = (model as any).observeQuery(filter).subscribe({
      next: (data: any) => {
        setResult(data);
      },
    });
    return () => sub.unsubscribe();
  }, [modelName]);
  return { ...result };
}

// export function useObserveCategories() {
//     const {client} = useContext(GlobalContext)!;
//     const model = client.models.Category;
//     type ResultType = {
//         items: Schema['Category']['type'][];
//         isSynced: boolean;
//     };
//     const [result, setResult] = useState<ResultType>({items:[],isSynced:false});
//     model.observeQuery({});
//     useEffect(() => {
//         const sub = model.observeQuery().subscribe({
//             next: (data) => { setResult(data)},
//         });
//         return () => sub.unsubscribe();
//     }, [model]);
//     return result;
// }
