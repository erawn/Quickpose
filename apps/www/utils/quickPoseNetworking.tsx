import { TDDocument, TDFile, TDShapeType } from "@tldraw/tldraw";
import FormData from 'form-data'
import type { FileSystemHandle } from '@tldraw/tldraw'
import axios from 'axios'
import deepEqual from "deep-equal";

const LOCALHOST_BASE = 'http://127.0.0.1:8080';


export const sendFork = async (id) => {
	const response = await fetch(LOCALHOST_BASE + '/fork/' + id)
	return await response.json();
	
}
export const sendSelect = async (id) => {
	const response = await fetch(LOCALHOST_BASE + '/select/' + id);
}
export function getIconImageURLNoTime(id:string){
	return LOCALHOST_BASE + "/image/" + id; //Add Time to avoid Caching so images update properly
}

export function getIconImageURL(id:string){
	return LOCALHOST_BASE + "/image/" + id + "?" + ((new Date()).getTime()); //Add Time to avoid Caching so images update properly
}

export const saveToProcessing = async (document: TDDocument, fileHandle: FileSystemHandle | null) => {
    console.log("saving file...")
    const file: TDFile = {
        name: 'quickpose.tldr',
        fileHandle: fileHandle ?? null,
        document,
        assets: {},
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
export const loadFileFromProcessing = async(loadFile,abortFileController) => {
    axios.get(LOCALHOST_BASE+'/tldrfile', {
      timeout: 100,
      signal: abortFileController.signal
    })
    .then(response => {
      if(response.status === 200){
        loadFile.current = response.data
        console.log("loaded file",response.data)
      }else{
        loadFile.current = undefined //this is the signal that we attempted to load a file, but it was missing
      }
    })
    .catch(error => {
      console.error("error fetching: ", error);
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
    axios.get(LOCALHOST_BASE+'/currentVersion', {
        timeout: timeout,
        signal: abortCurrentVersionController.signal
      })
      .then(response => {
        if(response.data){
          currentVersion.current = response.data.toString()
          //console.log("currentVersion is  "+ currentVersion.current)
        }
      })
      .catch(error => {
        //console.error("error fetching: ", error);
      })
  }