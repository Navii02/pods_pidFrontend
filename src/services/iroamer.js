import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const GetAllUnAssignedPath= async()=>{

}

export const getAllTagsDetails= async()=>{
    
}
export const getAllTags= async()=>{
    
}

export const GetAllmodals= async(projectId,areaIds,systemIds,discIds,tagIds)=>{
   console.log(projectId,areaIds,systemIds,discIds,tagIds);
    try {
        const response = await commonApi('GET',`${url}/api/getmodel/${projectId}/${areaIds}/${discIds}/${systemIds}/${tagIds}`)
         return response
    } catch (error) {
        throw error
    }
   
}