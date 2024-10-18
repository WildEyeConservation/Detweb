import { useMap } from "react-leaflet";
import { useContext,  useEffect } from "react";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { ImageContext } from "./Context";
import L from "leaflet";
import "leaflet-contextmenu";
import { LocationType } from "./schemaTypes";

export default function Location({x,y,width,height,confidence}: LocationType) {
  const { xy2latLng } = useContext(ImageContext)!;
  width ||= 100
  height ||= 100

  const boundsxy: [number, number][] = [
    [x - width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
  ];

  const map = useMap();
  
  const contextMenuItems = [
    {
      text: `Confidence : ${confidence}`,
      callback: () => console.log("conf callback"),
    },
  ];

  // if (user?.isAdmin) {
  //   contextMenuItems.push({
  //     text: isTest
  //       ? "Stop using this location as a test location"
  //       : "Use this location as a test location",
  //     callback: changeTest,
  //   });
  // }

  // function changeTest() {
  //   setKey(crypto.randomUUID());
  //   setTest(isTest ? null : Math.floor(Date.now() / 1000));
  //   gqlClient.graphql(
  //     graphqlOperation(updateLocation, {
  //       input: { id, isTest: isTest ? null : Math.floor(Date.now() / 1000) },
  //     })
  //   );
  // }

  useEffect(() => {
    const latLngBounds = xy2latLng(boundsxy) as unknown as L.LatLngBoundsLiteral;
    const rectangle = L.rectangle(latLngBounds, {
      // color: showTestCase && isTest ? "red" : "blue",
      color: "blue",
      fill: false,
    }).addTo(map);

    (rectangle as any).bindContextMenu({
      contextmenu: true,
      contextmenuInheritItems: false,
      contextMenuItems,
    });

    return () => {
      map.removeLayer(rectangle);
    };
  }, [map, boundsxy, contextMenuItems]);

  return null;
}
