"""Reuse the deployed stage client and add the publisher's H3 Turbo sampler graph."""
import argparse
from pathlib import Path
import stage_client as deployed

original_graph = deployed.graph_for


def graph_for(phase, request):
    graph = original_graph(phase, request)
    if phase == "sample" and request.get("lora_name"):
        graph["1"] = {"class_type": "OpeningTurboUNETLoader", "inputs": {"unet_name": "minimax_h3_fl2va_pruned_bf16.safetensors", "lora_name": request["lora_name"]}}
        graph["10"] = {"class_type": "MiniMaxH3SigmaShift", "inputs": {"model": ["1", 0], "shift_video": request["shift_video"], "shift_audio": request["shift_audio"]}}
        graph["5"]["inputs"]["model"] = ["10", 0]
        graph["6"]["inputs"]["model"] = ["10", 0]
    return graph


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=["encode", "sample", "decode"], required=True)
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--server-pid", type=int, required=True)
    parser.add_argument("--timeout", type=int, default=12600)
    deployed.graph_for = graph_for
    deployed.run(parser.parse_args())
