import { useContext, useState, useEffect } from 'react';
import * as L from 'leaflet';
import 'leaflet-contextmenu';
import 'leaflet/dist/leaflet.css';
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css';
import { Marker, Popup } from 'react-leaflet';
import { UserContext } from './UserContext';
import { ImageContext } from './Context';

function createIcon(categories: any[], annotation: Annotation) {
  const color =
    categories?.find((category) => category.id === annotation.categoryId)
      ?.color ?? 'red';
  const edgeColour = ['#000000', '#ffffff'];
  let attributes = '';
  if (annotation.selected) attributes += ' selected';
  if (annotation.candidate) attributes += ' candidate';
  if (annotation.note) attributes += ' withNote';
  let html = `<div class="marker" ${attributes}><div style="background-color: ${color}; border-color: ${
    edgeColour[annotation.linked ? 1 : 0]
  }">
    <span class="markerLabel">${
      annotation.label ? annotation.label : ''
    }</span></div></div>`;

  return L.divIcon({
    className: 'my-custom-pin',
    iconAnchor: [0, 0],
    //labelAnchor: [0, -100],
    popupAnchor: [0, -30],
    html: html,
  });
}

function getContextMenuItems(
  det: Annotation,
  user: any,
  categories: any[],
  deleteAnnotation: (annotation: Annotation) => void,
  updateAnnotation: (annotation: Annotation) => void
) {
  let contextmenuItems: any[] = [];
  contextmenuItems.push({
    text: 'Delete',
    index: contextmenuItems.length,
    callback: async () => {
      deleteAnnotation(det);
    },
  });
  contextmenuItems.push({
    text: det.note ? 'Edit Note' : 'Add Note',
    index: contextmenuItems.length,
  });
  contextmenuItems.push({ text: 'Link', index: contextmenuItems.length });
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
      text: 'Send message to ' + det.owner,
      index: contextmenuItems.length,
      callback: () => {
        let msg = prompt('Type the message here', 'This is not an elephant');
        console.log(msg);
      },
    };
    contextmenuItems.push(item);
  }
  return contextmenuItems;
}

export function useMarkers(imageId: string, setId: string) {
  const { annotations, createAnnotation, deleteAnnotation, updateAnnotation } =
    useAnnotations(imageId, setId);
  const { user, currentProject } = useContext(UserContext)!;
  const [markers, setMarkers] = useState<JSX.Element[]>([]);
  const { latLng2xy } = useContext(ImageContext)!;
  const { categories } = useCategoryByProject(currentProject);

  useEffect(() => {
    if (!annotations) return;

    setMarkers(
      annotations.map((annotation) => (
        <Marker
          key={annotation.id}
          eventHandlers={{
            dragend: (e) => {
              const coords = latLng2xy(e.target.getLatLng());
              if (Array.isArray(coords)) {
                const point = coords[0];
                annotation.x = point.x;
                annotation.y = point.y;
              } else {
                annotation.x = coords.x;
                annotation.y = coords.y;
              }
              updateAnnotation(annotation);
            },
            contextmenu: () => {
              const items = getContextMenuItems(
                annotation,
                user,
                categories,
                deleteAnnotation,
                updateAnnotation
              );
              // Implement your context menu display logic here
              console.log(items);
            },
          }}
          position={[-annotation.y / 64, annotation.x / 64]}
          icon={createIcon(categories, annotation)}
          draggable
          autoPan
        >
          <Popup>
            Users : {annotation.user?.name}
            <br />
            Created : {annotation.createdAt}
          </Popup>
        </Marker>
      ))
    );
  }, [
    categories,
    annotations,
    deleteAnnotation,
    updateAnnotation,
    user,
    latLng2xy,
  ]);

  return [markers, createAnnotation] as const;
}
