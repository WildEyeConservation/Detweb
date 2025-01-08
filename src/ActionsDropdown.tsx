import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

export default function ActionsDropdown({actions}: {actions: {label: string, onClick: () => void}[]}) {
  return (
    <DropdownButton
      as={ButtonGroup}
      variant="info"
      title={"Open"}
      className="me-2 fixed-width-button"
    >
      {actions.map((action, index) => (
        <Dropdown.Item key={index} eventKey={index.toString()} onClick={action.onClick}>
          {action.label}
        </Dropdown.Item>
      ))}
    </DropdownButton>
  )
}