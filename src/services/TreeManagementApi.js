import { commonApi } from "./apiStructure";
import { url } from "./Url";

export const RegisterArea = async(data)=>{
    //console.log(data);
    
    try {
        const response = await commonApi('POST',`${url}/api/add-area`,data)
        return response
    } catch (error) {
        throw error
    }
}
export const RegisterSystem = async(data)=>{
    try {
        const response = await commonApi('POST',`${url}/api/add-system`,data)
                return response

    } catch (error) {
        throw error
    }
}
export const RegisterDisipline= async(data)=>{
    try {
        const response = await commonApi('POST',`${url}/api/add-disipline`,data)
                return response

    } catch (error) {
        throw error
    }
}

 export  const getSystem  = async(id)=>{
    try {
         const response = await commonApi('GET',`${url}/api/getsystems/${id}`,)
         //console.log( response);
         return response
    } catch (error) {
        throw error
    }
 }
 
export const updateSystem = async (data) => {
  try {
    const response = await commonApi('PUT', `${url}/api/updatesystem`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteSystem = async (id) => {
  try {
    const response = await commonApi('DELETE', `${url}/api/deletesystem/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteAllSystems = async () => {
  try {
    const response = await commonApi('DELETE', `${url}/api/deleteallsystems`);
    return response;
  } catch (error) {
    throw error;
  }
};
 export  const getDisipline  = async(id)=>{
  //console.log(id)
    try {
         const response = await commonApi('GET',`${url}/api/getdispline/${id}`,)
         //console.log( response);
         return response
    } catch (error) {
        throw error
    }
 }
 
export const updateDiscipline = async (data) => {
  try {
    const response = await commonApi('PUT', `${url}/api/updatediscipline`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteDiscipline = async (id) => {
  try {
    const response = await commonApi('DELETE', `${url}/api/deletediscipline/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteAllDisciplines = async () => {
  try {
    const response = await commonApi('DELETE', `${url}/api/deletealldisciplines`);
    return response;
  } catch (error) {
    throw error;
  }
};

 export  const getArea  = async(id)=>{
    try {
         const response = await commonApi('GET',`${url}/api/getarea/${id}`,)
         //console.log( response);
         return response
    } catch (error) {
        throw error
    }
 }
export const updateArea = async (data) => {
  try {
    const response = await commonApi('PUT', `${url}/api/updatearea`, data);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteArea = async (id) => {
  try {
    const response = await commonApi('DELETE', `${url}/api/deletearea/${id}`);
    return response;
  } catch (error) {
    throw error;
  }
};

export const deleteAllAreas = async () => {
  try {
    const response = await commonApi('DELETE', `${url}/api/deleteallareas`);
    return response;
  } catch (error) {
    throw error;
  }
};







 
 export const RegisterEnitity = async(entityType,data)=>{
  //console.log(data);
  
    const endpoints = {
    Area: 'api/project-areas',
    System: 'api/project-systems',
    Discipline: 'api/project-disciplines'
  };
  const endpoint = endpoints[entityType] || endpoints.Area;
  try {
    const response =  await commonApi('POST',`${url}/${endpoint}`,data)
    return response
    
  } catch (error) {
    throw error
    
  }

 }
   export const RegisterTagsforsystem = async(data)=>{
    try {
         const response = await commonApi('POST',`${url}/api/project-tags`,data)
         return response
        
    } catch (error) {
       throw error 
    }
   }

  export const GetEntities = async(entityType,id)=>{
    //console.log( entityType);
    
    
        const endpoints = {
    Area: 'api/project-getarea',
    System: 'api/project-getsystem',
    Discipline: 'api/project-getdisipline',
    tag:'api/project-gettags'
  };
  const endpoint = endpoints[entityType] || endpoints.Area;
  try {
    const response =  await commonApi('GET',`${url}/${endpoint}/${id}`)
    //console.log(response);
    
    return response
    
  } catch (error) {
    throw error
    
  }

 }
  export const getProjectArea = async(id,type)=>{
    try {
      const response = await commonApi('GET',`${url}/api/getproject-area/${id}`,type)
      return response
      
    } catch (error) {
      throw error
    }

  }

   export const getprojectDisipline = async(area,id)=>{
    //console.log(id,area);
    
    try {
         const response =await commonApi('GET',`${url}/api/getproject-disipline?area=${area}&project_id=${id}`,)
         //console.log(response);
         
         return response
        
    } catch (error) {
        throw error
    }
   }
export const getprojectsystem = async ( projectId,area, disc) => {
    //console.log(projectId,area,disc);

  try {
    const response = await commonApi(
      'GET',
      `${url}/api/getproject-system?project_id=${projectId}&area=${area}&disc=${disc}`
    );
    return response;
  } catch (error) {
    throw error;
  }
};
export const getProjectTags = async ( projectId,area, disc,sys) => {
    //console.log(projectId,area,disc);

  try {
    const response = await commonApi(
      'GET',
      `${url}/api/getproject-tags?project_id=${projectId}&area=${area}&disc=${disc}&sys=${sys}`
    );
    //console.log(response);
    
    return response;
  } catch (error) {
    throw error;
  }
};
  export const DeleteEntity = async(type, project_id, code)=>{
  const params = { type, project_id, code };
  try {
    const response = await commonApi(`DELETE`,`${url}/api/deleteEntity`,{},null,params)
    return response
  } catch (error) {
    throw error
  }
  }