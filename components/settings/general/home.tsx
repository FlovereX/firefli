"use client";

import axios from "axios";
import React, { useState, useMemo, useEffect } from "react";
import type toast from "react-hot-toast";
import { useRecoilState } from "recoil";
import { workspacestate } from "@/state";
import { FC } from "@/types/settingsComponent";
import { IconCheck, IconLayoutGrid, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import clsx from "clsx";
import dynamic from "next/dynamic";

// Dynamically import the layout editor to avoid SSR issues
const LayoutEditor = dynamic(() => import("./LayoutEditor"), { ssr: false });

type props = {
  triggerToast: typeof toast;
  isSidebarExpanded?: boolean;
  hasResetActivityOnly?: boolean;
};

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

const Color: FC<props> = (props) => {
  const triggerToast = props.triggerToast;
  const [workspace, setWorkspace] = useRecoilState(workspacestate);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);

  // Normalize layout so it always matches enabled widgets
  const currentLayout = useMemo(() => {
    const widgets = Array.isArray(workspace.settings?.widgets)
      ? workspace.settings.widgets
      : [];
    const savedLayout = Array.isArray(workspace.settings?.layout)
      ? workspace.settings.layout
      : [];

    const savedByWidget = new Map(savedLayout.map((item: WidgetLayout) => [item.i, item]));

    return widgets.map((widget: string, index: number) => {
      const existing = savedByWidget.get(widget);
      return {
        i: widget,
        x: (index % 2) * 6,
        y: Math.floor(index / 2) * 4,
        w: existing?.w || 6,
        h: existing?.h || 4,
        minW: existing?.minW || 4,
        minH: existing?.minH || 3,
        maxW: existing?.maxW,
        maxH: existing?.maxH,
      };
    });
  }, [workspace.settings?.widgets, workspace.settings?.layout]);

  const [layout, setLayout] = useState<WidgetLayout[]>(currentLayout);

  useEffect(() => {
    setLayout(currentLayout);
  }, [currentLayout]);

  const updateHome = async () => {
    try {
      const res = await axios.patch(
        `/api/workspace/${workspace.groupId}/settings/general/home`,
        {
          widgets: workspace.settings.widgets,
          layout: showLayoutEditor ? layout : undefined,
        }
      );
      if (res.status === 200) {
        // Update workspace state with new layout
        setWorkspace({
          ...workspace,
          settings: {
            ...workspace.settings,
            layout: showLayoutEditor ? layout : workspace.settings.layout,
          },
        });
        triggerToast.success("Updated home");
      } else {
        triggerToast.error("Failed to update home");
      }
    } catch (error) {
      triggerToast.error("Failed to update home");
    }
  };

  const toggleAble: {
    [key: string]: string;
  } = {
    "Ongoing sessions": "sessions",
    "Latest wall messages": "wall",
    "Latest documents": "documents",
    "Inactivity Notices": "notices",
    "Upcoming Birthdays": "birthdays",
    "New Team Members": "new_members",
  };

  const toggle = (name: string) => {
    const widgetId = toggleAble[name];
    if (workspace.settings.widgets.includes(widgetId)) {
      // Remove widget and its layout
      setWorkspace({
        ...workspace,
        settings: {
          ...workspace.settings,
          widgets: workspace.settings.widgets.filter(
            (widget) => widget !== widgetId
          ),
        },
      });
      setLayout(layout.filter((item) => item.i !== widgetId));
    } else {
      // Add widget with default layout
      const newWidget = {
        i: widgetId,
        x: (workspace.settings.widgets.length % 2) * 6,
        y: Math.floor(workspace.settings.widgets.length / 2) * 4,
        w: 6,
        h: 4,
        minW: 4,
        minH: 3,
      };
      setWorkspace({
        ...workspace,
        settings: {
          ...workspace.settings,
          widgets: [...workspace.settings.widgets, widgetId],
        },
      });
      setLayout([...layout, newWidget]);
    }
  };

  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    const currentIndex = workspace.settings.widgets.indexOf(widgetId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= workspace.settings.widgets.length) return;
    
    const newWidgets = [...workspace.settings.widgets];
    [newWidgets[currentIndex], newWidgets[newIndex]] = [newWidgets[newIndex], newWidgets[currentIndex]];
    
    // Swap layouts too
    const newLayout = [...layout];
    const currentLayoutIndex = newLayout.findIndex(l => l.i === widgetId);
    const targetLayoutIndex = newLayout.findIndex(l => l.i === newWidgets[newIndex]);
    if (currentLayoutIndex !== -1 && targetLayoutIndex !== -1) {
      [newLayout[currentLayoutIndex], newLayout[targetLayoutIndex]] = [newLayout[targetLayoutIndex], newLayout[currentLayoutIndex]];
    }
    
    setWorkspace({
      ...workspace,
      settings: {
        ...workspace.settings,
        widgets: newWidgets,
      },
    });
    setLayout(newLayout);
  };

  const changeWidgetSize = (widgetId: string, width: number) => {
    const newLayout = layout.map(item => {
      if (item.i === widgetId) {
        return { ...item, w: width };
      }
      return item;
    });
    setLayout(newLayout);
  };

  const widgetSizes = [
    { label: 'Small', value: 4, cols: '4 cols' },
    { label: 'Medium', value: 6, cols: '6 cols' },
    { label: 'Large', value: 8, cols: '8 cols' },
    { label: 'Full', value: 12, cols: '12 cols' },
  ];

  const handleLayoutChange = (newLayout: any[]) => {
    setLayout(newLayout.map((item: any) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
      maxW: item.maxW,
      maxH: item.maxH,
    })));
  };

  const widgetTitles: { [key: string]: string } = {
    sessions: "Ongoing Sessions",
    wall: "Wall Messages",
    documents: "Documents",
    notices: "Inactivity Notices",
    birthdays: "Birthdays",
    new_members: "New Members",
  };

  return (
    <div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
        Customise what appears on your workspace home page. Tiles will only be
        shown to users with the corresponding permissions.
      </p>

      {/* Widget Selection */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
          Select & Order Widgets
        </h3>
        <div className="space-y-2">
          {workspace.settings.widgets.map((widgetId, index) => {
            const widgetName = Object.keys(toggleAble).find(
              (key) => toggleAble[key] === widgetId
            );
            if (!widgetName) return null;
            
            // Calculate display number (filter out nulls before this index)
            const displayNumber = workspace.settings.widgets
              .slice(0, index + 1)
              .filter(id => Object.values(toggleAble).includes(id))
              .length;
            
            return (
              <div
                key={widgetId}
                className="flex flex-col gap-2 p-3 rounded-lg border border-primary bg-primary/5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveWidget(widgetId, 'up')}
                      disabled={index === 0}
                      className={clsx(
                        "p-1 rounded transition-colors",
                        index === 0
                          ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      )}
                      title="Move up"
                    >
                      <IconChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => moveWidget(widgetId, 'down')}
                      disabled={index === workspace.settings.widgets.length - 1}
                      className={clsx(
                        "p-1 rounded transition-colors",
                        index === workspace.settings.widgets.length - 1
                          ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      )}
                      title="Move down"
                    >
                      <IconChevronDown size={16} />
                    </button>
                  </div>
                  <span className="flex-1 text-sm font-medium text-primary dark:text-white">
                    {displayNumber}. {widgetName}
                  </span>
                  <button
                    onClick={() => toggle(widgetName)}
                    className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-10">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Size:</span>
                  <div className="flex gap-1">
                    {widgetSizes.map((size) => {
                      const currentWidth = layout.find(l => l.i === widgetId)?.w || 6;
                      return (
                        <button
                          key={size.value}
                          onClick={() => changeWidgetSize(widgetId, size.value)}
                          className={clsx(
                            "px-2 py-1 text-xs rounded transition-colors",
                            currentWidth === size.value
                              ? "bg-primary text-white"
                              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                          )}
                          title={size.cols}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Available widgets to add */}
        {Object.keys(toggleAble).some(
          (key) => !workspace.settings.widgets.includes(toggleAble[key])
        ) && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
              Available Widgets
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.keys(toggleAble)
                .filter((key) => !workspace.settings.widgets.includes(toggleAble[key]))
                .map((key, i) => (
                  <button
                    key={i}
                    onClick={() => toggle(key)}
                    className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-zinc-700 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    <span className="text-sm">{key}</span>
                    <span className="text-xs text-zinc-500">+ Add</span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Layout Editor Toggle */}
      {workspace.settings.widgets.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowLayoutEditor(!showLayoutEditor)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
              showLayoutEditor
                ? "border-primary bg-primary/5 text-primary dark:text-white"
                : "border-gray-200 dark:border-zinc-700 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
            )}
          >
            <IconLayoutGrid size={18} />
            <span className="text-sm font-medium">
              {showLayoutEditor ? "Hide" : "Show"} Layout Editor
            </span>
          </button>
        </div>
      )}

      {/* Layout Editor */}
      {showLayoutEditor && workspace.settings.widgets.length > 0 && (
        <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
              Layout Preview
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              This shows how your selected widgets will appear on the home page
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              ⚠️ Early testing - please report any bugs you encounter
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 min-h-[400px] border border-zinc-200 dark:border-zinc-700">
            <LayoutEditor
              layout={layout}
              onLayoutChange={handleLayoutChange}
              widgetTitles={widgetTitles}
            />
          </div>
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={updateHome}
          className={clsx(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
            workspace.groupTheme === "bg-firefli"
              ? "bg-firefli text-white hover:bg-firefli/90"
              : workspace.groupTheme === "bg-blue-500"
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : workspace.groupTheme === "bg-red-500"
              ? "bg-red-500 text-white hover:bg-red-600"
              : workspace.groupTheme === "bg-red-700"
              ? "bg-red-700 text-white hover:bg-red-800"
              : workspace.groupTheme === "bg-green-500"
              ? "bg-green-500 text-white hover:bg-green-600"
              : workspace.groupTheme === "bg-green-600"
              ? "bg-green-600 text-white hover:bg-green-700"
              : workspace.groupTheme === "bg-yellow-500"
              ? "bg-yellow-500 text-white hover:bg-yellow-600"
              : workspace.groupTheme === "bg-orange-500"
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : workspace.groupTheme === "bg-purple-500"
              ? "bg-purple-500 text-white hover:bg-purple-600"
              : workspace.groupTheme === "bg-pink-500"
              ? "bg-pink-500 text-white hover:bg-pink-600"
              : workspace.groupTheme === "bg-black"
              ? "bg-black text-white hover:bg-zinc-900"
              : "bg-zinc-500 text-white hover:bg-zinc-600"
          )}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

Color.title = "Home";

export default Color;