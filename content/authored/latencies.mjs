/**
 * The 13 canonical latency figures, for the log-scale chart on the latency
 * numbers section. Authored — the sync never touches this.
 *
 * `ns` drives the bar width; `value` is the label as the primer writes it.
 */
export const LATENCIES = [
  { label: "L1 cache reference", ns: 0.5, value: "0.5 ns" },
  { label: "Branch mispredict", ns: 5, value: "5 ns" },
  { label: "L2 cache reference", ns: 7, value: "7 ns" },
  { label: "Mutex lock/unlock", ns: 25, value: "25 ns" },
  { label: "Main memory reference", ns: 100, value: "100 ns" },
  { label: "Send 1KB over 1 Gbps network", ns: 10000, value: "10 µs" },
  { label: "Read 4KB randomly from SSD", ns: 150000, value: "150 µs" },
  { label: "Read 1MB sequentially from memory", ns: 250000, value: "250 µs" },
  { label: "Round trip within same datacenter", ns: 500000, value: "500 µs" },
  { label: "Read 1MB sequentially from SSD", ns: 1000000, value: "1 ms" },
  { label: "Disk seek", ns: 10000000, value: "10 ms" },
  { label: "Read 1MB sequentially from disk", ns: 20000000, value: "20 ms" },
  { label: "Packet CA → Netherlands → CA", ns: 150000000, value: "150 ms" },
];

export const SOURCE = {
  repo: "donnemartin/system-design-primer",
  branch: "master",
  file: "README.md",
  url: "https://github.com/donnemartin/system-design-primer",
  raw: "https://raw.githubusercontent.com/donnemartin/system-design-primer/master",
  blob: "https://github.com/donnemartin/system-design-primer/blob/master",
  licence: "CC BY 4.0",
};
