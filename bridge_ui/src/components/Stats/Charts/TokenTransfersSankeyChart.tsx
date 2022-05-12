import { Layer, Rectangle, ResponsiveContainer, Sankey } from "recharts";
import useTokenTransfers from "../../../hooks/useTokenTransfers";
import { TokenTransfersChartData } from "./utils";

const Node = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isOut = x + width + 6 > containerWidth;
  return (
    <Layer key={`CustomNode${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#5192ca"
        fillOpacity="1"
      />
      <text
        textAnchor={isOut ? "end" : "start"}
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2}
        fontSize="14"
        stroke="#FFF"
      >
        {payload.name}
      </text>
      <text
        textAnchor={isOut ? "end" : "start"}
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2 + 13}
        fontSize="12"
        stroke="#FFF"
        strokeOpacity="0.5"
      >
        {payload.value + "k"}
      </text>
    </Layer>
  );
};

const TokenTransfersSankeyChart = ({
  data,
}: {
  data: TokenTransfersChartData;
}) => {
  //const data = {
  //  nodes: [
  //    { name: "bETH" },
  //    { name: "WETH" },
  //    { name: "FTX" },
  //    { name: "Solana" },
  //    { name: "BSC" },
  //    { name: "Terra" },
  //  ],
  //  links: [
  //    { source: 0, target: 3, value: 1000 },
  //    { source: 0, target: 4, value: 100 },
  //    { source: 0, target: 5, value: 10 },

  //    { source: 1, target: 3, value: 100 },
  //    { source: 1, target: 4, value: 100 },
  //    { source: 1, target: 5, value: 10 },

  //    { source: 2, target: 3, value: 1 },
  //    { source: 2, target: 4, value: 1 },
  //    { source: 2, target: 5, value: 1 },
  //  ],
  //};

  return (
    <ResponsiveContainer height={452}>
      <Sankey
        data={data}
        node={<Node containerWidth={960} />}
        margin={{ top: 20, bottom: 20 }}
      />
    </ResponsiveContainer>
  );
};

export default TokenTransfersSankeyChart;
