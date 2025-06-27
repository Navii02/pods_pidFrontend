import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const getBaseSettings= async(projectId)=>{
 try {
     const response = await commonApi('GET',`${url}/api/get-base-settings/${projectId}`)
      return response
 } catch (error) {
    throw error
 }
}

export const getWaterSettings= async(projectId)=>{
   try {
     const response = await commonApi('GET',`${url}/api/get-water-settings/${projectId}`)
      return response
 } catch (error) {
    throw error
 }  
}
export const getGroundSettings= async(projectId)=>{
     try {
     const response = await commonApi('GET',`${url}/api/get-ground-settings/${projectId}`)
      return response
 } catch (error) {
    throw error
 }
}

 export const updateWaterSettings=async(watersettings)=>{
    try {
        const response = await commonApi('PUT',`${url}/api/upate-water-settings`,watersettings)
        return response
    } catch (error) {
        throw error
    }
 }
 export const updateBaseSettings=async(basesetting)=>{
    try {
        const response = await commonApi('PUT',`${url}/api/upate-base-settings`,basesetting)
        return response
    } catch (error) {
        throw error
    }
 }
 export const updateGroundSettings=async(groundsettings)=>{
    try {
        const response = await commonApi('PUT',`${url}/api/upate-ground-settings`,groundsettings)
        return response
    } catch (error) {
        throw error
    }
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