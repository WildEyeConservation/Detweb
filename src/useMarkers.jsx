import React, { useContext, useState, useEffect } from "react";
import * as L from "leaflet";
import "leaflet-contextmenu";
import "leaflet/dist/leaflet.css";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { Marker, Popup } from "react-leaflet";
import { UserContext } from "./UserContext";
import { CategoriesContext } from "./Categories";
import { useAnnotations } from "./useGqlCached";
import { ImageContext } from "./BaseImage";

function createIcon(categories, annotation) {
  const color =
    categories?.find((category) => category.id === annotation.categoryId)
      ?.color ?? "red";
  const edgeColour = ["#000000", "#ffffff"];
  let attributes = "";
  if (annotation.selected) attributes += " selected";
  if (annotation.candidate) attributes += " candidate";
  if (annotation.note) attributes += " withNote";
  let html = `<div class="marker" ${attributes}><div style="background-color: ${color}; border-color: ${edgeColour[annotation.linked ? 1 : 0]}">
    <span class="markerLabel">${annotation.label ? annotation.label : ""}</span></div></div>`;
  //TODO : Confirm the units implicit in the various anchors defined below. If these are in pixels (or any other
  // absolute unit) then things may break upon a resize or even just on different resolution screens.
  // if (detection.selected)
  //   html =`<div class="spinning">${html}</div>`;
  // if (detection.candidate)
  //   html =`<div class="throbbing">${html}</div>`;
  return L.divIcon({
    className: "my-custom-pin",
    iconAnchor: [0, 0],
    labelAnchor: [0, -100],
    popupAnchor: [0, -30],
    html: html,
  });
}

function getContextMenuItems(
  det,
  user,
  categories,
  deleteAnnotation,
  updateAnnotation,
) {
  let contextmenuItems = [];
  contextmenuItems.push({
    text: "Delete",
    index: contextmenuItems.length,
    callback: async () => {
      deleteAnnotation(det);
    },
  });
  contextmenuItems.push({
    text: det.note ? "Edit Note" : "Add Note",
    index: contextmenuItems.length,
  });
  contextmenuItems.push({ text: "Link", index: contextmenuItems.length });
  if (contextmenuItems.length) {
    contextmenuItems.push({ separator: true, index: contextmenuItems.length });
  }
  for (let category of categories) {
    if (det.categoryId !== category.id) {
      let item = {
        text: `Change to ${category.name}`,
        index: contextmenuItems.length,
        callback: async () => {
          det.categoryId = category.id;
          updateAnnotation(det);
        },
      };
      contextmenuItems.push(item);
    }
  }
  if (user.isAdmin) {
    const item = {
      text: "Send message to " + det.owner,
      index: contextmenuItems.length,
      callback: () => {
        let msg = prompt("Type the message here", "This is not an elephant");
        console.log(msg);
      },
    };
    contextmenuItems.push(item);
  }
  return contextmenuItems;
}

export function useMarkers(imageId, setId) {
  const { annotations, createAnnotation, deleteAnnotation, updateAnnotation } =
    useAnnotations(imageId, setId);
  const [categories] = useContext(CategoriesContext);
  const { user } = useContext(UserContext);
  const [markers, setMarkers] = useState([]);
  const { latLng2xy } = useContext(ImageContext);

  useEffect(() => {
    setMarkers(
      annotations?.map((annotation) => (
        <Marker
          /* Because I am potentially changing immutable properties below (specifically contextMenuItems), 
        I need to ensure that the key changes on every render, so that instead of trying to modify props and expecting the component to 
        update, I am replacing the entire component on every render.
        */
          key={
            annotation.y + annotation.id + annotation.categoryId + annotation.x
          }
          eventHandlers={{
            dragend: (e) => {
              let coords = latLng2xy(e.target.getLatLng());
              annotation.x = coords.x;
              annotation.y = coords.y;
              updateAnnotation(annotation);
            },
          }}
          position={[-annotation.y / 64, annotation.x / 64]}
          draggable={true}
          autopan={true}
          icon={createIcon(categories, annotation)}
          contextmenu={true}
          contextmenuInheritItems={false}
          contextmenuItems={getContextMenuItems(
            annotation,
            user,
            categories,
            deleteAnnotation,
            updateAnnotation,
          )}
        >
          <Popup>
            Users : {annotation?.user?.name}
            <br />
            Created : {annotation?.createdAt}
          </Popup>
        </Marker>
      )),
    );
  }, [categories, annotations, deleteAnnotation, updateAnnotation, user]);
  return [markers, createAnnotation];
}
