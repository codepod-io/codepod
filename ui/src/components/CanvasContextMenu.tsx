import { useStore } from "zustand";
import { RepoContext } from "../lib/store";
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import React, { useContext } from 'react';
import CodeIcon from '@mui/icons-material/Code';
import PostAddIcon from '@mui/icons-material/PostAdd';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';

const paneMenuStyle = (left, top) => {
    return ({
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 100,
        position: 'absolute',
        boxShadow: '0px 1px 8px 0px rgba(0, 0, 0, 0.1)',
        // width: '200px',
        backgroundColor: '#fff',
        borderRadius: '5px',
        boxSizing: 'border-box',
    }) as React.CSSProperties;
};


export function CanvasContextMenu(props) {
    const store = useContext(RepoContext);
    if (!store) throw new Error("Missing BearContext.Provider in the tree");
    const showLineNumbers = useStore(store, (state) => state.showLineNumbers);
    const flipShowLineNumbers = useStore(store, (state) => state.flipShowLineNumbers);
    return (
        <div style={paneMenuStyle(props.x, props.y)}>
            <MenuList className='paneContextMenu'>
                <MenuItem onClick={props.addCode}>
                    <ListItemIcon><CodeIcon /></ListItemIcon>
                    <ListItemText>New Code</ListItemText>
                </MenuItem>
                <MenuItem onClick={props.addScope}>
                    <ListItemIcon><PostAddIcon /></ListItemIcon>
                    <ListItemText>New Scope</ListItemText>
                </MenuItem>
                <MenuItem onClick={flipShowLineNumbers}>
                    <ListItemIcon><FormatListNumberedIcon /></ListItemIcon>
                    <ListItemText>{showLineNumbers ? 'Hide ' : 'Show '} Line Numbers</ListItemText>
                </MenuItem>
            </MenuList>
        </div>
    );
}