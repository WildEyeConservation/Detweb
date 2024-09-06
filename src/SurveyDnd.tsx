import React from "react";
import { Droppable, Draggable, DraggableProvided, DroppableProvided, DraggableStateSnapshot, DroppableStateSnapshot } from "react-beautiful-dnd";
import Button from "react-bootstrap/Button";
import DndTask, { getItemStyle, getListStyle } from "./DndTask";

interface SurveyDraggableProps {
  item: SurveyItem;
  index: number;
  sets: SetElement[];
}

interface SurveyItem {
  uniqueId: string;
  name: string;
  id: string;
}

interface SetElement {
  stratum: string;
}

const SurveyDraggable: React.FC<SurveyDraggableProps> = ({ item, index, sets }) => (
  <Draggable key={item.uniqueId} draggableId={item.uniqueId} index={index}>
    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={getItemStyle(
          snapshot.isDragging,
          provided.draggableProps.style,
        )}
      >
        <DndTask
          id={item.uniqueId}
          name={item.name}
          elements={sets}
          multipleCols={true}
        />
      </div>
    )}
  </Draggable>
);

interface SurveyDndProps {
  uniqueId: string;
  id: string;
  name: string;
  elements: SurveyItem[];
  sets: SetElement[];
  onDelete?: (id: string) => void;
}

const SurveyDnd: React.FC<SurveyDndProps> = ({ uniqueId, id, name, elements, sets, onDelete }) => (
  <div>
    {onDelete ? (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-evenly",
        }}
      >
        <h4>{name}</h4>
        <Button onClick={() => onDelete(id)}>Delete</Button>
      </div>
    ) : (
      <h4
        style={{
          display: "flex",
          justifyContent: "center",
          paddingBottom: 8,
        }}
      >
        {name}
      </h4>
    )}
    <Droppable key={name} droppableId={uniqueId}>
      {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          style={getListStyle(snapshot.isDraggingOver)}
          {...provided.droppableProps}
        >
          {elements.map((item, index) => (
            <SurveyDraggable
              key={item.uniqueId}
              item={item}
              index={index}
              sets={sets.filter((set) => set.stratum === item.id)}
            />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  </div>
);

export default SurveyDnd;
