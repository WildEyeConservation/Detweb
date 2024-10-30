import { Button } from "react-bootstrap";
import { GlobalContext, ManagementContext } from "./Context";
import { useContext } from "react";
import { list } from 'aws-amplify/storage';
import { remove } from 'aws-amplify/storage';
import { fetchAllPaginatedResults } from "./utils";
import { ProjectContext, UserContext } from "./Context";
import UserStats from "./UserStats";

export function DevActions() {
    const { client } = useContext(GlobalContext)!;
    const { project } = useContext(ProjectContext)!;
    const { user: currentUser } = useContext(UserContext)!;
    const {allUsers} = useContext(ManagementContext)
    
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

    const getUserStats = 
    "query MyQuery($userId: ID! , $projectId: ID! ) {\
        getUserObservationStats(projectId: $projectId, userId: $userId) {\
            count\
            updatedAt\
            activeTime\
        }\
    }"

    const updateUserStats = 
    "mutation MyMutation($count: Int!, $activeTime: Int!, $projectId: ID!, $userId: ID!) {\
        updateUserObservationStats(input: {projectId: $projectId, userId: $userId, count: $count, activeTime: $activeTime}) {\
            updatedAt\
        }\
    }"

    const createUserStats = "\
    mutation MyMutation2($projectId: ID!, $userId: ID!) {\
        createUserObservationStats(input: {activeTime: 0, count: 1, projectId: $projectId, userId: $userId}) {\
            updatedAt\
        }\
    }"

    async function updateStats(input: string) {
        const parsed=JSON.parse(input);
        const result = await client.graphql({
            query: getUserStats,
            variables: {
                userId: parsed.owner.S.split('::')[1],
                projectId: parsed.projectId.S
            }
        })
        const stats = result.data?.getUserObservationStats;
        if (stats) {
            console.log(stats)
            const elapsed = (new Date().getTime() - new Date(stats.updatedAt).getTime()) / 1000;
            await client.graphql({
                // Calculate the number of seconds elapsed since stats.updatedAt which is an ISO string
                query: updateUserStats,
                variables: { 
                    userId: parsed.owner.S.split('::')[1],
                    projectId: parsed.projectId.S,
                    count: stats.count + 1,
                    activeTime: (elapsed<120) ? Math.round(stats.activeTime + elapsed) : stats.activeTime
                }
            })
        } else {
            await client.graphql({
                query: createUserStats,
                variables: {
                    projectId: parsed.projectId.S,
                    userId: parsed.owner.S.split('::')[1]
                }
            })
        }
    }

    function createInput() {
        //Print the current time in the following format 2024-10-30T10:04:09.423Z
        return `{\"owner\":{\"S\":\"${currentUser.userId}::${currentUser.userId}\"},\
        \"annotationSetId\":{\"S\":\"50bbfaa2-788c-4b84-b919-e98c7adc019d\"},\
        \"createdAt\":{\"S\":\"${new Date().toISOString()}\"},\"locationId\":{\"S\":\"a62f54f2-500b-4bc4-b7a8-f299cc48c476\"},\
        \"__typename\":{\"S\":\"Observation\"},\"id\":{\"S\":\"1c9905c6-82ea-4c01-8704-e3478187cd53\"},\
        \"projectId\":{\"S\":\"${project.id}\"},\
        \"updatedAt\":{\"S\":\"${new Date().toISOString()}\"}}`
    }

    async function recomputeUserStats() {
        let records = {}
        //const allObservations = await fetchAllPaginatedResults(client.models.Observation.list)
        const { data: allObservations } = await client.models.Observation.list()
        //Sort the observations by updatedAt
        allObservations.sort((a,b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        for (const observation of allObservations) {
            let projectrecords = records?.[observation.projectId];
            if (!projectrecords) {
                projectrecords = {}
                records[observation.projectId] = projectrecords
            }
            let userrecords = projectrecords[observation.owner];
            if (!userrecords) {
                userrecords = { count: 0, activeTime: 0, lastUpdated: observation.updatedAt }
                projectrecords[observation.owner] = userrecords
            }
            userrecords.count += 1
            const elapsed = (new Date(observation.updatedAt).getTime() - new Date(userrecords.lastUpdated).getTime()) / 1000;
            console.log(observation.updatedAt)
            console.log(elapsed)
            userrecords.activeTime += (elapsed < 120) ? elapsed : 0
            userrecords.lastUpdated = observation.updatedAt
        }
        // Now iterate over the records and update the UserObservationStats
        for (const projectId in records) {
            for (const userId in records[projectId]) {
                try{
                    await client.models.UserObservationStats.create({
                        userId: userId,
                        projectId: projectId,
                        count: records[projectId][userId].count,
                        activeTime: Math.round(records[projectId][userId].activeTime)
                    })
                } catch (e) {
                    await client.models.UserObservationStats.update({
                        userId: userId,
                        projectId: projectId,
                        count: records[projectId][userId].count,
                        activeTime: Math.round(records[projectId][userId].activeTime)
                    })
                }
            }
        }
        console.log(records)
    }

    async function createUserStatsTable() {
        const { data: allUserStats } = await client.models.UserObservationStats.list()
        const table = allUserStats.filter(s => s.projectId == project.id)
                                  .map(s => {
            return [allUsers.find(u => u.id == s.userId)?.name,s.count,s.activeTime,s.activeTime/s.count]
        })
        console.log(table)
    }


        
        
        // const { items } = await list({ path: 'images', options: { bucket: 'inputs', listAll: true } });
        // await Promise.all(items.map(async (item, idx) => {
        //     await updateStats(item.path);
        // }));
    return <div>
        <h2>Dev Actions</h2>
        <UserStats/>
        <Button onClick={deleteOrphans}>Delete orphanned files from S3.</Button>
        <Button onClick={deleteImages}>Delete Image Records with no associated ImageFiles.</Button>
        <Button onClick={findImages}>Find Images without GeoData.</Button>
        <Button onClick={() => updateStats(createInput())}>Simulate UserStat update.</Button>
        <Button onClick={recomputeUserStats}>Recompute UserStats</Button>
        <Button onClick={createUserStatsTable}>Create UserStats Table</Button>
    </div>
}