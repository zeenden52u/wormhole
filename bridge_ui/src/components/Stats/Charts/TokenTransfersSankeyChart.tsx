import { Typography } from "@material-ui/core";
import { useState } from "react";
import { Layer, Rectangle, ResponsiveContainer, Sankey } from "recharts";
import useTokenTransfers from "../../../hooks/useTokenTransfers";
import { formatTVL, TokenTransfersChartData } from "./utils";

const Link = ({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  index,
}: any) => {
  const [opacity, setOpacity] = useState(0.5);

  return (
    <Layer key={`CustomLink${index}`}>
      <path
        d={`
            M${sourceX},${sourceY + linkWidth / 2}
            C${sourceControlX},${sourceY + linkWidth / 2}
              ${targetControlX},${targetY + linkWidth / 2}
              ${targetX},${targetY + linkWidth / 2}
            L${targetX},${targetY - linkWidth / 2}
            C${targetControlX},${targetY - linkWidth / 2}
              ${sourceControlX},${sourceY - linkWidth / 2}
              ${sourceX},${sourceY - linkWidth / 2}
            Z
          `}
        fill={"gray"}
        opacity={opacity}
        onMouseEnter={() => {
          setOpacity(1);
        }}
        onMouseLeave={() => {
          setOpacity(0.5);
        }}
      />
    </Layer>
  );
};

const Node = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isOut = x + width + 6 > containerWidth;
  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill="purple"
        fillOpacity="1"
      />
      <text
        textAnchor={isOut ? "end" : "start"}
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2}
        fontSize="16"
        fill="white"
        // strokeOpacity="0.5"
      >
        {formatTVL(payload.value)}
      </text>
      <text
        textAnchor={isOut ? "end" : "start"}
        x={isOut ? x - 6 - 100 : x + width + 6 + 100}
        y={y + height / 2}
        fontSize="16"
        fill="white"
      >
        {payload.name}
      </text>
    </Layer>
  );
};

const TokenTransfersSankeyChart = ({
  data,
}: {
  data: TokenTransfersChartData;
}) => {
  return (
    <ResponsiveContainer height={452}>
      <Sankey
        data={data}
        node={<Node containerWidth={960} />}
        link={<Link />}
        // margin={{ top: 20, bottom: 20 }}
        nodePadding={32}
        // link={{ stroke: "#77c878" }}
        iterations={0}
      />
    </ResponsiveContainer>
  );
};

export default TokenTransfersSankeyChart;
