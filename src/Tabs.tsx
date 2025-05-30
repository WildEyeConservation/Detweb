import React, { useState, ReactElement } from "react";
import "./Tabs.css";

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
}

export const Tab: React.FC<TabProps> = ({ children, className }) => {
  return <div className={`d-block ${className}`}>{children}</div>;
};

export const Tabs: React.FC<TabsProps> = ({
  children,
  defaultTab = 0,
  onTabChange,
  className,
  sharedChild,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const childrenArray = React.Children.toArray(children) as ReactElement<TabProps>[];

  return (
    <div className="w-100">
      <div className={`tabs-header border-bottom border-dark ${className}`}>
        {childrenArray.map((child, index) => (
          <div
            key={index}
            className={`tab-label ${activeTab === index ? "bg-primary" : ""}`}
            onClick={() => {
              setActiveTab(index);
              onTabChange?.(index);
            }}
          >
            {child.props.label}
          </div>
        ))}
      </div>
      <div>
        {sharedChild}
        {childrenArray[activeTab]}
      </div>
    </div>
  );
};
