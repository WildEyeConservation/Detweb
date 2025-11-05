import React, { useState, ReactElement } from 'react';
import './Tabs.css';

interface TabProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

interface TabsProps {
  children: ReactElement<TabProps> | ReactElement<TabProps>[];
  defaultTab?: number;
  onTabChange?: (tab: number) => void;
  className?: string;
  sharedChild?: React.ReactNode;
  disableSwitching?: boolean;
}

export const Tab: React.FC<TabProps> = ({ children, className }) => {
  return (
    <div className={`d-flex flex-column w-100 h-100 ${className ?? ''}`}>
      {children}
    </div>
  );
};

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultTab = 0,
  onTabChange,
  className,
  sharedChild,
  disableSwitching = false,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const childrenArray = React.Children.toArray(
    children
  ) as ReactElement<TabProps>[];

  return (
    <div className={`w-100 h-100 d-flex flex-column ${className ?? ''}`}>
      <div className='tabs-header border-bottom border-dark'>
        {childrenArray.map((child, index) => (
          <div
            key={index}
            className={`tab-label py-2 px-3 ${
              activeTab === index ? 'bg-primary' : ''
            }`}
            onClick={() => {
              if (disableSwitching) return;
              setActiveTab(index);
              onTabChange?.(index);
            }}
          >
            {child.props.label}
          </div>
        ))}
      </div>
      <div className='flex-grow-1 d-flex flex-column w-100 h-100'>
        {sharedChild}
        {childrenArray[activeTab]}
      </div>
    </div>
  );
};
