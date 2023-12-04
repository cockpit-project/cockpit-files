import React from "react";
import { Menu, MenuContent } from "@patternfly/react-core";

import "./contextMenu.scss";

export const ContextMenu = ({ parentId, contextMenuItems, setSelectedContext }) => {
    const [visible, setVisible] = React.useState(false);
    const [event, setEvent] = React.useState(null);
    const root = React.useRef(null);
    const parentRef = React.useRef(null); // Add a ref for the parent element

    React.useEffect(() => {
        parentRef.current = document.getElementById(parentId); // Set the parentRef when the component mounts
    }, [parentId]);

    React.useEffect(() => {
        const _handleContextMenu = (event) => {
            event.preventDefault();
            setVisible(true);
            setEvent(event);
        };

        const _handleClick = (event) => {
            if (event && event.button === 0) {
                const wasOutside = !parentRef.current.contains(event.target); // Check against parentRef

                if (wasOutside) {
                    setVisible(false);
                    setSelectedContext(null);
                }
            }
        };

        if (parentRef.current) { // Check if parentRef is valid
            parentRef.current.addEventListener("contextmenu", _handleContextMenu);
            document.addEventListener("click", _handleClick);
        }

        return () => {
            if (parentRef.current) { // Check if parentRef is valid
                parentRef.current.removeEventListener("contextmenu", _handleContextMenu);
            }
            document.removeEventListener("click", _handleClick);
        };
    }, [parentId, setSelectedContext]);

    React.useEffect(() => {
        if (!event)
            return;

        const clickX = event.clientX;
        const clickY = event.clientY;
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const rootW = root.current.offsetWidth;
        const rootH = root.current.offsetHeight;

        const right = (screenW - clickX) > rootW;
        const left = !right;
        const top = (screenH - clickY) > rootH;
        const bottom = !top;

        if (right) {
            root.current.style.left = `${clickX + 5}px`;
        }

        if (left) {
            root.current.style.left = `${clickX - rootW - 5}px`;
        }

        if (top) {
            root.current.style.top = `${clickY + 5}px`;
        }

        if (bottom) {
            root.current.style.top = `${clickY - rootH - 5}px`;
        }
    }, [event]);

    return visible && (
        <Menu ref={root} className="context-menu">
            <MenuContent ref={root}>
                {contextMenuItems}
            </MenuContent>
        </Menu>
    );
};
