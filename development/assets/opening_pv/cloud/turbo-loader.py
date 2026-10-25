"""Dedicated H3 Turbo loader for the isolated, GPU-only production process.

The native adapter loader keeps rollback copies of almost every base weight.
This process only uses one fixed adapter, so commit its fully applied weights
as the process-local model and release those copies before sampling. Original
checkpoint and adapter files remain unchanged; a new process loads them afresh.
"""
import gc
import json
import uuid

import comfy.model_management
import nodes
import torch

BASE = "minimax_h3_fl2va_pruned_bf16.safetensors"
ADAPTER = "minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"


class OpeningTurboUNETLoader:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"unet_name": ([BASE],), "lora_name": ([ADAPTER],)}}

    RETURN_TYPES = ("MODEL",)
    FUNCTION = "load"
    CATEGORY = "opening-production"

    def load(self, unet_name, lora_name):
        if (unet_name, lora_name) != (BASE, ADAPTER):
            raise ValueError("This loader is restricted to the pinned opening-film models")
        base = nodes.UNETLoader().load_unet(unet_name, "default")[0]
        model = nodes.LoraLoaderModelOnly().load_lora_model_only(base, lora_name, 1.0)[0]
        if model.load_device.type != "cuda" or model.offload_device != model.load_device:
            raise ValueError("The production loader requires the isolated GPU-only process")
        if not model.patches:
            raise ValueError("The pinned Turbo adapter did not match the base model")
        patch_count = len(model.patches)
        comfy.model_management.load_models_gpu([model], force_full_load=True)
        if model.model.model_lowvram or model.model.current_weight_patches_uuid != model.patches_uuid:
            raise RuntimeError("Adapter application was incomplete; retain rollback state")
        backup_bytes = sum(entry.weight.numel() * entry.weight.element_size() for entry in model.backup.values())
        if not backup_bytes:
            raise RuntimeError("Expected native rollback copies after applying the adapter")
        # This standalone loader exposes only the committed model. Neither the
        # unadapted base nor a second adapter branch enters the cached graph.
        model.patches.clear()
        model.backup.clear()
        model.patches_uuid = uuid.uuid4()
        model.model.current_weight_patches_uuid = model.patches_uuid
        del base
        gc.collect()
        comfy.model_management.soft_empty_cache(force=True)
        print(json.dumps({"event": "OPENING_TURBO_WEIGHTS_COMMITTED", "adapterStrength": 1.0, "patchedWeights": patch_count, "rollbackBytesReleased": backup_bytes, "cudaAllocatedBytes": torch.cuda.memory_allocated(model.load_device), "checkpointFilesModified": False}), flush=True)
        return (model,)


NODE_CLASS_MAPPINGS = {"OpeningTurboUNETLoader": OpeningTurboUNETLoader}
NODE_DISPLAY_NAME_MAPPINGS = {"OpeningTurboUNETLoader": "Opening Film: Fixed H3 Turbo"}
