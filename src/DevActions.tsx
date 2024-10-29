import { Button } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { useContext } from "react";
import { list } from 'aws-amplify/storage';
import { remove } from 'aws-amplify/storage';

export function DevActions() {
    const { client } = useContext(GlobalContext)!;
    const deleteOrphans = async () => {
        const prefix = prompt('Provide the prefix to scan (omit images/)');
        if (!prefix) return;
        const {items} = await list({
            path: `images/${prefix}`,
            options:{bucket:'inputs',listAll:true}
          });
        await Promise.all(items.map(async (item,idx) => {
            const { data } = await client.models.ImageFile.imagesByPath({ path: item.path.slice('images/'.length) })
            if (data.length == 0) {
                console.log(`Deleting ${item.path}`);
                await remove({key:item.path,options:{bucket:'inputs'}});
            }
            if (idx % 100 == 0) {
                console.log(`${idx}/${items.length}`)
            }

        }));
    }

    return <div>
        <h2>Dev Actions</h2>
        <Button onClick={deleteOrphans}>Delete orphanned files from S3.</Button>
    </div>
}