export const yRemoteSelectionStyle = (clientID: string, color: string) => {
  return `.yRemoteSelection-${clientID} 
    { background-color: ${color}; opacity: 0.5;} `;
};

export const yRemoteSelectionHeadStyle = (clientID: string, color: string) => {
  return `.yRemoteSelectionHead-${clientID} {  
        position: absolute;
        border-left: ${color} solid 2px;
        border-top: ${color} solid 2px;
        border-bottom: ${color} solid 2px;
        height: 100%;
        box-sizing: border-box;}`;
};

export const yRemoteSelectionHeadHoverStyle = (
  clientID: string,
  color: string,
  name: string
) => {
  return `.yRemoteSelectionHead-${clientID}:hover::after { 
        content: "${name}"; 
        background-color: ${color}; 
        box-shadow: 0 0 0 2px ${color};
        border: 1px solid ${color};
        color: white;
        opacity: 1; }`;
};

export function addAwarenessStyle(
  clientID: string,
  color: string,
  name: string
) {
  const styles = document.createElement("style");
  styles.append(yRemoteSelectionStyle(clientID, color));
  styles.append(yRemoteSelectionHeadStyle(clientID, color));
  styles.append(yRemoteSelectionHeadHoverStyle(clientID, color, name));
  document.head.append(styles);
}
