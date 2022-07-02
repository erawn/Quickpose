import { TDDocument, TDFile, TDShapeType, TldrawApp } from "@tldraw/tldraw";
import FormData from 'form-data'
import type { FileSystemHandle } from '@tldraw/tldraw'

import axiosRetry, { exponentialDelay } from 'axios-retry';
import RaxConfig from "axios-retry";
import deepEqual from "deep-equal";
import { useCallback } from "react";
import axios from 'axios'
const LOCALHOST_BASE = 'http://127.0.0.1:8080';


export const sendFork = async (id) => {
    const response = await fetch(LOCALHOST_BASE + '/fork/' + id)
    return await response.json();
    
}
export const sendSelect = async (id) => {
    const response = await fetch(LOCALHOST_BASE + '/select/' + id);
    return await response.json();
}
export function getIconImageURLNoTime(id:string){
    return LOCALHOST_BASE + "/image/" + id; //Add Time to avoid Caching so images update properly
}

export function getIconImageURL(id:string){
    return LOCALHOST_BASE + "/image/" + id + "?" + ((new Date()).getTime()); //Add Time to avoid Caching so images update properly
}

export const saveToProcessing = async (document: TDDocument, simData: string, alpha, fileHandle: FileSystemHandle | null) => {
    const file: TDFile = {
        name: 'quickpose.tldr',
        fileHandle: fileHandle ?? null,
        document,
        assets: {"simData":simData,
                "alpha":alpha.toString()
                },
      }
    // Serialize to JSON
    const json = JSON.stringify(file, null, 2)
    // Create blob
    const blob = new Blob([json], {
      type: 'application/vnd.Tldraw+json',
    })
    const formData = new FormData()
    formData.append('uploaded_file', blob, { //'uploaded_file' is a special name that the Processing side is looking for, don't change or itll break
      filename: 'quickpose.tldr',
      contentType: 'application/vnd.Tldraw+json'
    })

    axios.post(LOCALHOST_BASE+'/tldrfile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        "Content-Disposition": "filename=quickpose.tldr.png"
      }
    })
    .then(function (response) {
      //console.log(response);
    })
    .catch(function (error) {
      //console.log(error);
    });
    
    return true
}
export const loadFileFromProcessing = async(loadFile, netData, newData, abortFileController) => {

    const getFile = axios.get(LOCALHOST_BASE+'/tldrfile', {
      timeout: 2000,
      signal: abortFileController.signal
    })

    const getData = axios.get(LOCALHOST_BASE+'/versions.json', {
        timeout: 2000,
        signal: abortFileController.signal
      })

    axios.all([getFile,getData]).then(axios.spread((...responses) => {

        const file = responses[0]
        const data = responses[1]
        if(file.status === 200 && data.data && loadFile.current === null){ //this third conditional is to avoid race conditions
            loadFile.current = file.data
            netData.current = data.data
            abortFileController.abort()
            console.log("loaded file - aborting file requests")
        }else if(file.status === 201){
            loadFile.current = undefined //this is the signal that we attempted to load a file, but it was missing
        }

        // use/access the results 
      
      })).catch(errors => {
      
        // react on errors.
      
      })
  }

export const updateVersions = async (netData, newData, abortVersionsController:AbortController) => {
    //Update Versions
    
    axios.get(LOCALHOST_BASE+'/versions.json', {
      timeout: 100,
      signal: abortVersionsController.signal
    })
    .then(response => {
      if(!deepEqual(response.data,netData.current)){
        newData.current = true;
        netData.current = response.data
        //console.log("newdata",response.data)
        //dataInterval()
      }else{
        //console.log("samedata",response.data)
      }
    })
    .catch(error => {
      //console.error("error fetching: ", error);
    })
  }
export const updateThumbnail = (selectedNode, rTldrawApp) => {
    //Update Thumbnail Image
    if(selectedNode.current){
      const app = rTldrawApp.current!
      
      const selectedShape = app.getShape(selectedNode.current)
      if(!(selectedShape === undefined) && selectedShape.type == TDShapeType.VersionNode){
        const idInteger = selectedShape.id.replace(/\D/g,"")
        selectedShape.imgLink = getIconImageURL(idInteger)//refresh the thumbnail image
        app.updateShapes(selectedShape)
      }
    }
  }

  export const updateCurrentVersion = async (currentVersion, timeout,abortCurrentVersionController) => {
    const client = axios.create()
        axiosRetry(client, { 
          retries: 10,
          shouldResetTimeout: true,
          retryDelay(retryCount, error) {
              return 10*retryCount
          },
          onRetry(retryCount, error, requestConfig) {
              console.log("retrying upload",retryCount)
          },
         });
    await client.get(LOCALHOST_BASE+'/currentVersion', {
        timeout: timeout,
        //signal: abortCurrentVersionController.signal
      })
      .then(response => {
        if(response.data){
          currentVersion.current = response.data.toString()
          return true
          //console.log("currentVersion is  "+ currentVersion.current)
        }else{
          return false
        }
      })
      .catch(error => {
        //console.warn("error fetching current version: ", error);
        return null
      })
  }

  export function useUploadAssets() {
    const onAssetUpload = useCallback(
      // Send the asset to our upload endpoint, which in turn will send it to AWS and
      // respond with the URL of the uploaded file.
      
      async (app: TldrawApp, file: File, id: string): Promise<string | false> => {
        const filename = encodeURIComponent(file.name)
        const url = LOCALHOST_BASE+"/assets/"+filename
        console.log("making url",url)
        const client = axios.create()
        axiosRetry(client, { 
          retries: 10,
          shouldResetTimeout: true,
          onRetry(retryCount, error, requestConfig) {
              console.log("retrying upload",retryCount)
          },
         });
        const formData = new FormData()
        formData.append('uploaded_file', file, file.name)//dont change 'uploaded_file' - processing side is looking for this label
        await client.put(url, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          })
          .catch(function (error) {
            console.error("error uploading image: ", error);
          });
        const res = await client.get(url)
        const status = await res.status
        if(status === 200){
          return url
        }else{
          return false
        }
      },
      []
    )
    const onAssetDelete = useCallback(
      // Send the asset to our upload endpoint, which in turn will send it to AWS and
      // respond with the URL of the uploaded file.
  
      async (app: TldrawApp, id: string): Promise<boolean>=> {
        const asset = app.assets.find(asset => asset.id === id)
        await axios.delete(asset.src).then(response =>{
          if(response.status == 200){
            return true
          }
        }).catch(function(error){ 
          console.error("error deleting image: ",id, error);
          return false
        })
        return false
      },
      []
    )
  
    return { onAssetUpload, onAssetDelete }
  }