module roundtrip;

// ROLE: Standalone, headless WP-020 native-engine proof driver; not production code.
// AUTHORITY: Synthetic fixture only. This file does not own Tegaki Project, History, or save state.
// INVARIANTS: Fixed Inochi2D source SHA; no engine repairs; outputs stay in ignored cache.
// RELATED: docs/work/WP-020-rig-renewal-first-path.md and this folder's README.md.

import inochi2d.core;
import std.file : write;
import std.json : JSONValue;
import std.math : abs;
import std.stdio : writeln;

enum SOURCE_COMMIT = "66fa76834b28037db0c871c656563422f697879e";
enum CACHE_ROOT = "tegaki_work/.cache/inochi-roundtrip";
enum EPSILON = 0.0001f;

struct Sample {
    float parameter;
    vec2[] points;
}

struct EditCapture {
    Sample[] baseline;
    Sample[] edited;
    Sample[] reverted;
    ubyte[] editedBytes;
}

void require(bool condition, string message) {
    if (!condition) {
        throw new Exception(message);
    }
}

vec2[] offsetsFor(float topVertexY) {
    return [
        vec2(0f, 0f),
        vec2(0f, topVertexY),
        vec2(0f, 0f)
    ];
}

ubyte[] makeOriginalFixture() {
    MeshData mesh;
    mesh.vertices = [
        vec2(0f, 0f),
        vec2(10f, 0f),
        vec2(0f, 10f)
    ];
    mesh.uvs = [
        vec2(0f, 0f),
        vec2(1f, 0f),
        vec2(0f, 1f)
    ];
    mesh.indices = [0u, 1u, 2u];

    Node root = new Node();
    Texture[] textures;
    Part part = new Part(mesh, textures, root);
    part.name = "proof-raster";
    part.blendingMode = BlendMode.normal;

    Puppet puppet = new Puppet(root);
    puppet.enableDrivers = false;

    Parameter parameter = new Parameter("proof-bend", false);
    parameter.min = vec2(0f, 0f);
    parameter.max = vec2(1f, 0f);
    parameter.defaults = vec2(0f, 0f);
    parameter.axisPoints[0] = [0f, 1f];
    parameter.axisPoints[1] = [0f];

    DeformationParameterBinding binding =
        new DeformationParameterBinding(parameter, part, "deform");
    binding.update(vec2u(0, 0), offsetsFor(0f));
    binding.update(vec2u(1, 0), offsetsFor(2f));
    parameter.addBinding(binding);
    puppet.parameters = [parameter];

    ubyte[] bytes = inWriteINPPuppetMemory(puppet);
    destroy(puppet);
    return bytes;
}

Part requireSinglePart(Puppet puppet) {
    require(puppet.root !is null, "Loaded puppet has no root node");
    require(puppet.root.children.length == 1, "Fixture must have exactly one root child");
    Part part = cast(Part)puppet.root.children[0];
    require(part !is null, "Fixture root child is not a Part");
    require(part.blendingMode == BlendMode.normal, "Fixture blend mode is not normal");
    require(part.masks.length == 0, "Fixture must not contain mask bindings");
    require(part.mesh.vertices.length == 3, "Fixture mesh must have exactly three vertices");
    require(part.mesh.indices.length == 3, "Fixture mesh must have exactly one triangle");
    return part;
}

Parameter requireSingleParameter(Puppet puppet) {
    require(puppet.parameters.length == 1, "Fixture must have exactly one parameter");
    Parameter parameter = puppet.parameters[0];
    require(parameter.axisPoints[0].length == 2, "Parameter must have exactly two keyforms");
    require(parameter.axisPoints[1].length == 1, "Parameter must be one-dimensional");
    require(parameter.bindings.length == 1, "Parameter must have exactly one binding");
    require(parameter.bindings[0].getSetCount() == 2, "Binding must contain exactly two authored keyforms");
    return parameter;
}

Sample[] evaluateThreeValues(Puppet puppet, Part part, Parameter parameter) {
    float[3] values = [0f, 0.5f, 1f];
    Sample[] samples;

    foreach (value; values) {
        parameter.value = vec2(value, 0f);
        puppet.update(0f);
        puppet.draw(0f);
        samples ~= Sample(value, part.deformPoints.dup);
    }

    return samples;
}

bool closeEnough(float a, float b) {
    return abs(a - b) <= EPSILON;
}

bool sameSamples(Sample[] a, Sample[] b) {
    if (a.length != b.length) return false;
    foreach (i; 0 .. a.length) {
        if (!closeEnough(a[i].parameter, b[i].parameter)) return false;
        if (a[i].points.length != b[i].points.length) return false;
        foreach (j; 0 .. a[i].points.length) {
            if (!closeEnough(a[i].points[j].x, b[i].points[j].x)) return false;
            if (!closeEnough(a[i].points[j].y, b[i].points[j].y)) return false;
        }
    }
    return true;
}

void requireTopVertexY(Sample[] samples, float atZero, float atHalf, float atOne, string label) {
    require(samples.length == 3, label ~ " must contain three samples");
    require(closeEnough(samples[0].points[1].y, atZero), label ~ " y at parameter 0 mismatched");
    require(closeEnough(samples[1].points[1].y, atHalf), label ~ " y at parameter 0.5 mismatched");
    require(closeEnough(samples[2].points[1].y, atOne), label ~ " y at parameter 1 mismatched");
}

EditCapture editAndSave(ubyte[] originalBytes) {
    Puppet puppet = inLoadINPPuppet(originalBytes);
    require(puppet !is null, "Official INP loader returned null for the original fixture");
    puppet.enableDrivers = false;

    Part part = requireSinglePart(puppet);
    Parameter parameter = requireSingleParameter(puppet);
    DeformationParameterBinding binding =
        cast(DeformationParameterBinding)parameter.bindings[0];
    require(binding !is null, "Loaded keyform binding is not a deformation binding");

    EditCapture capture;
    capture.baseline = evaluateThreeValues(puppet, part, parameter);
    requireTopVertexY(capture.baseline, 0f, 1f, 2f, "Original evaluation");

    // Edit the second authored keyform through Inochi2D's native binding API.
    binding.update(vec2u(1, 0), offsetsFor(6f));
    capture.edited = evaluateThreeValues(puppet, part, parameter);
    requireTopVertexY(capture.edited, 0f, 3f, 6f, "Edited evaluation");
    require(!sameSamples(capture.baseline, capture.edited), "Keyform edit did not change native evaluator output");

    // Reapply the original keyform and prove the edit can be withdrawn.
    binding.update(vec2u(1, 0), offsetsFor(2f));
    capture.reverted = evaluateThreeValues(puppet, part, parameter);
    require(sameSamples(capture.baseline, capture.reverted), "Restoring the original keyform did not restore baseline output");

    // Reapply the chosen edit and serialize a real native INP container.
    binding.update(vec2u(1, 0), offsetsFor(6f));
    capture.editedBytes = inWriteINPPuppetMemory(puppet);
    require(capture.editedBytes.length > 16, "Native INP writer returned an unexpectedly short payload");

    destroy(puppet);
    puppet = null;
    return capture;
}

JSONValue pointsToJson(vec2[] points) {
    JSONValue array = JSONValue.emptyArray;
    foreach (point; points) {
        JSONValue pair = JSONValue.emptyArray;
        pair.array ~= JSONValue(cast(double)point.x);
        pair.array ~= JSONValue(cast(double)point.y);
        array.array ~= pair;
    }
    return array;
}

JSONValue samplesToJson(Sample[] samples) {
    JSONValue array = JSONValue.emptyArray;
    foreach (sample; samples) {
        JSONValue item = JSONValue.emptyObject;
        item["parameter"] = JSONValue(cast(double)sample.parameter);
        item["evaluatedVertices"] = pointsToJson(sample.points);
        array.array ~= item;
    }
    return array;
}

void main() {
    ubyte[] originalBytes = makeOriginalFixture();
    write(CACHE_ROOT ~ "/fixture-original.inp", originalBytes);

    EditCapture capture = editAndSave(originalBytes);
    write(CACHE_ROOT ~ "/fixture-edited.inp", capture.editedBytes);

    // editAndSave has returned only after explicitly destroying the source instance.
    Puppet reloaded = inLoadINPPuppet(capture.editedBytes);
    require(reloaded !is null, "Official INP loader returned null for edited bytes");
    reloaded.enableDrivers = false;

    Part reloadedPart = requireSinglePart(reloaded);
    Parameter reloadedParameter = requireSingleParameter(reloaded);
    Sample[] afterReload = evaluateThreeValues(reloaded, reloadedPart, reloadedParameter);
    requireTopVertexY(afterReload, 0f, 3f, 6f, "Reloaded evaluation");
    require(sameSamples(capture.edited, afterReload), "New instance did not reproduce edited evaluator output");

    bool corruptInputRejected;
    ubyte[] corrupted = capture.editedBytes.dup;
    corrupted[0] ^= 0xFF;
    try {
        Puppet rejected = inLoadINPPuppet(corrupted);
        if (rejected !is null) destroy(rejected);
    } catch (Throwable) {
        corruptInputRejected = true;
    }
    require(corruptInputRejected, "Official INP loader accepted the corrupted magic header");

    JSONValue result = JSONValue.emptyObject;
    result["status"] = JSONValue("PASS");
    result["sourceCommit"] = JSONValue(SOURCE_COMMIT);
    result["engineVersion"] = JSONValue("fixed-source-66fa76834b28037db0c871c656563422f697879e; nightly source snapshot, not release v0.8.7");
    result["container"] = JSONValue("official INP container written/read by inochi2d.core.format.inp");
    result["model"] = JSONValue.emptyObject;
    result["model"]["parts"] = JSONValue(1);
    result["model"]["parameterCount"] = JSONValue(1);
    result["model"]["keyformCount"] = JSONValue(2);
    result["model"]["blendMode"] = JSONValue("normal");
    result["model"]["physicsNodes"] = JSONValue(0);
    result["model"]["driversEnabled"] = JSONValue(false);
    result["model"]["maskBindings"] = JSONValue(0);
    result["model"]["composites"] = JSONValue(0);
    result["originalByteCount"] = JSONValue(cast(double)originalBytes.length);
    result["editedByteCount"] = JSONValue(cast(double)capture.editedBytes.length);
    result["baseline"] = samplesToJson(capture.baseline);
    result["editedBeforeSave"] = samplesToJson(capture.edited);
    result["afterEditWithdrawal"] = samplesToJson(capture.reverted);
    result["afterDestroyAndReload"] = samplesToJson(afterReload);
    result["checks"] = JSONValue.emptyObject;
    result["checks"]["nativeEvaluationChangedAfterKeyformEdit"] = JSONValue(!sameSamples(capture.baseline, capture.edited));
    result["checks"]["editWithdrawalRestoredBaseline"] = JSONValue(sameSamples(capture.baseline, capture.reverted));
    result["checks"]["freshInstanceReproducedEditedOutput"] = JSONValue(sameSamples(capture.edited, afterReload));
    result["checks"]["corruptedInputRejected"] = JSONValue(corruptInputRejected);
    result["pixels"] = JSONValue("NOT MEASURED: headless native drawlist/evaluated vertices only");
    result["wasmBrowserProjectIntegration"] = JSONValue("UNKNOWN");

    write(CACHE_ROOT ~ "/roundtrip-result.json", result.toPrettyString ~ "\n");
    destroy(reloaded);
    reloaded = null;
    writeln("PASS: native INP edit/save/destroy/reload, 0/0.5/1 evaluation, edit withdrawal, corrupted input rejection.");
}
