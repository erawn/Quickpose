import * as React from 'react'
import ForceGraph2D from "react-force-graph-2d";

// const getDate = (data, type) => {
//     var timeStr;
//     if (type === "relative") {
//       timeStr = moment(data).startOf("ymd").fromNow();
//     } else if (type === "LongDate") {
//       timeStr = moment(
//         moment(new Date(data * 1000) / 1000).format("YYYY-MM-DDTHH:mm:ss")
//       ).format("D MMM YYYY, h:mm A");
//     }

//     return timeStr;
//   };

// class forceGraph extends React.Component {
//   state = {
//     data: [],
//   };


// }

export function forceGraph(props) {
    const [data, setData] = React.useState({ nodes: [{ id: 0 }], links: [] });
    //const graphRef = React.useRef(null);


    React.useEffect(() => {
        setData(props.graphData);
    }, [data])


    return (
          <ForceGraph2D
            graphData={data}
          />
      )
}