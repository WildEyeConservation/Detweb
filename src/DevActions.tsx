import { Button } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { useContext } from "react";
import { list } from 'aws-amplify/storage';
import { remove } from 'aws-amplify/storage';
import { fetchAllPaginatedResults } from "./utils";
import { ProjectContext } from "./Context";

export function DevActions() {
    const { client } = useContext(GlobalContext)!;
    const {project} = useContext(ProjectContext)!;
    const deleteOrphans = async () => {
        const prefix = prompt('Provide the prefix to scan (omit images/)');
        if (!prefix) return;
        const {items} = await list({
            path: `images/${prefix}`,
            options:{bucket:'inputs',listAll:true}
          });
        await Promise.all(items.map(async (item, idx) => {
            const { data } = await client.models.ImageFile.imagesByPath({ path: item.path.slice('images/'.length) })
            if (data.length == 0) {
                console.log(`Deleting ${item.path}`);
                await remove({path:item.path,options:{bucket:'inputs'}});
            }
            if (idx % 100 == 0) {
                console.log(`${idx}/${items.length}`)
            }
        }));
    }
    const deleteImages = async () => {
        const images = await fetchAllPaginatedResults(client.models.Image.list,
            { selectionSet: ['id'] as const });        
        const imageFiles = await fetchAllPaginatedResults(client.models.ImageFile.list,
            { selectionSet: ['imageId'] as const });
        // Now compute the set difference between images and imageFiles
        const imageIds1 = [...images.map(i => i.id)];
        const imageIds2 = new Set([...imageFiles.map(i => i.imageId).filter(id => id != null) as string[]]);
        const orphanedImageIds = imageIds1.filter(id => !imageIds2.has(id));
        for (const id of orphanorphanedImageIds) {
            const { data: image } = await client.models.Image.get({ id });
            const sets=await image.memberships();
            for (const set of sets) {
                console.log(`Deleting image ${id} from set ${set.id}`);
                await client.models.ImageSetMembership.delete({ imageId: id, imageSetId: set.id });
            }
            console.log(`Deleting image ${id}`);
            await client.models.Image.delete({ id });
        }
    }

    const findImages = async () => {
        const name = prompt('Provide the imageset to scan');
        const { data: sets } = await client.models.ImageSet.list();
        const set = sets.find(s => s.name == name);
        const result = await fetchAllPaginatedResults(client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
            { imageSetId: set.id, selectionSet: ['image.id', 'image.latitude', 'image.longitude'] as const });
        result.forEach(async item => {
            if (!item.image.latitude || !item.image.longitude) {
                const { data: files } = await client.models.ImageFile.imagesByimageId({ imageId: item.image.id })
                const file = files.find(f => f.type == 'image/jpeg');
                console.log(file.path)
            }
        });
    }

    const fixupImageSets = async () => {
        // images = [
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraA/Sango_R_A__05078_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03440_D2_03092024.JPG"
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03441_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03442_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03443_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03444_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03445_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03446_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03447_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__04298_D2_03092024.JPG",
        // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraA/Sango_R_A__05938_D3_04092024.JPG",
        // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraA/Sango_R_A__07238_D3_04092024.JPG",
        // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraB/Sango_L_B__05893_D3_04092024.JPG",
        // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraB/Sango_L_B__07131_D3_04092024.JPG"
        // ]
        // for (const image of images) {
        //     const cam= image.split('/')[2];
        //     const { data: files } = await client.models.ImageFile.imagesByPath({ path: image }, { selectionSet: ['image.timestamp'] })
        //     if (cam == 'CameraA') {
                
            

        //     const file = files.find(f => f.type == 'image/jpeg');
        //     console.log(file.path)
        // }
    }

    return <div>
        <h2>Dev Actions</h2>
        <Button onClick={deleteOrphans}>Delete orphanned files from S3.</Button>
        <Button onClick={deleteImages}>Delete Image Records with no associated ImageFiles.</Button>
        <Button onClick={findImages}>Find Images without GeoData.</Button>
    </div>
}