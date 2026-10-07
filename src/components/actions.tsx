"use client";

import { FileUp, Hash, Loader2, Upload } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { fileSize, mockHash, sha256Hex, shortHash } from "@/lib/format";
import { usdc } from "@/lib/fees";
import { me, type NewFile } from "@/lib/reducer";
import { useStore } from "@/lib/store";
import { usePackSummary } from "./panel/DisputePack";
import { Button, cx, Modal } from "./ui";

type Target = { wsId: string; milestoneId: string };

interface Ctx {
  submit: (t: Target, file?: File) => void;
  revise: (t: Target) => void;
  dispute: (t: Target) => void;
}

const ActionsCtx = createContext<Ctx | null>(null);

export function useWorkspaceActions() {
  const c = useContext(ActionsCtx);
  if (!c) throw new Error("useWorkspaceActions must be used inside <ActionsProvider>");
  return c;
}

export function ActionsProvider({ children }: { children: ReactNode }) {
  const [submitT, setSubmitT] = useState<(Target & { file?: File }) | null>(null);
  const [reviseT, setReviseT] = useState<Target | null>(null);
  const [disputeT, setDisputeT] = useState<Target | null>(null);

  const ctx: Ctx = {
    submit: useCallback((t, file) => setSubmitT({ ...t, file }), []),
    revise: useCallback((t) => setReviseT(t), []),
    dispute: useCallback((t) => setDisputeT(t), []),
  };

  return (
    <ActionsCtx.Provider value={ctx}>
      {children}
      {submitT && <SubmitDialog target={submitT} onClose={() => setSubmitT(null)} />}
      {reviseT && <RevisionDialog target={reviseT} onClose={() => setReviseT(null)} />}
      {disputeT && <DisputeDialog target={disputeT} onClose={() => setDisputeT(null)} />}
    </ActionsCtx.Provider>
  );
}

function useTarget(t: Target) {
  const { state } = useStore();
  const ws = state.workspaces[t.wsId];
  const idx = ws.milestones.findIndex((m) => m.id === t.milestoneId);
  return { ws, ms: ws.milestones[idx], idx: idx + 1 };
}

function MilestoneLine({ t }: { t: Target }) {
  const { ms, idx } = useTarget(t);
  return (
    <div className="mb-4 rounded-xl bg-rail px-3.5 py-2.5 ring-1 ring-line">
      <p className="text-xs text-muted">Giai đoạn {idx}</p>
      <p className="font-semibold">{ms.title}</p>
      <p className="text-sm font-medium text-ink-2">{usdc(ms.amount)}</p>
    </div>
  );
}

const textarea =
  "w-full resize-none rounded-xl bg-rail px-3.5 py-2.5 text-[15px] text-ink ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-yellow/60";

/* ---------- Nộp sản phẩm ---------- */

function SubmitDialog({ target, onClose }: { target: Target & { file?: File }; onClose: () => void }) {
  const { dispatch } = useStore();
  const { ms, ws } = useTarget(target);
  const version = ms.submissionIds.length + 1;
  const slug = ws.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const sample = `${slug}-v${version}.fig`;

  const [file, setFile] = useState<NewFile | null>(null);
  const [hashing, setHashing] = useState(!!target.file);
  const [note, setNote] = useState(version > 1 ? `v${version}: đã sửa theo góp ý.` : "");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const take = useCallback(async (f: File) => {
    setHashing(true);
    const hash = await sha256Hex(f);
    setFile({ name: f.name, size: f.size, hash, kind: f.type.startsWith("image/") ? "image" : "file" });
    setHashing(false);
  }, []);

  // file được kéo thả thẳng vào khung chat
  useEffect(() => {
    const f = target.file;
    if (!f) return;
    let alive = true;
    sha256Hex(f).then((hash) => {
      if (!alive) return;
      setFile({ name: f.name, size: f.size, hash, kind: f.type.startsWith("image/") ? "image" : "file" });
      setHashing(false);
    });
    return () => {
      alive = false;
    };
  }, [target.file]);

  const confirm = () => {
    if (!file) return;
    dispatch({ type: "SUBMIT", wsId: ws.id, milestoneId: ms.id, file, note: note.trim() || `Bản nộp v${version}` });
    onClose();
  };

  return (
    <Modal
      open
      title={version > 1 ? `Nộp lại sản phẩm (v${version})` : "Nộp sản phẩm"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!file}>
            <FileUp size={16} /> Nộp cho nghiệm thu
          </Button>
        </>
      }
    >
      <MilestoneLine t={target} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) void take(f);
        }}
        className={cx(
          "rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          over ? "border-yellow bg-white/4" : "border-line",
        )}
      >
        {hashing ? (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-2">
            <Loader2 size={16} className="animate-spin" /> Đang tính SHA-256…
          </p>
        ) : file ? (
          <div className="text-left">
            <p className="truncate font-semibold">{file.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-cyan">
              <Hash size={12} /> sha256 {shortHash(file.hash)} · {fileSize(file.size)}
            </p>
          </div>
        ) : (
          <>
            <Upload className="mx-auto text-yellow" size={26} />
            <p className="mt-2 text-sm text-ink-2">Kéo thả file vào đây hoặc</p>
            <div className="mt-2 flex justify-center gap-2">
              <Button onClick={() => input.current?.click()}>Chọn file</Button>
              <Button
                variant="ghost"
                onClick={() => setFile({ name: sample, size: 6_815_744 + version * 524_288, hash: mockHash(sample) })}
              >
                Dùng file mẫu
              </Button>
            </div>
          </>
        )}
        <input
          ref={input}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void take(f);
          }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        Hash được tính ngay trên trình duyệt, file không rời khỏi máy trong bản demo.
      </p>
      <label className="mt-4 block text-sm font-medium text-ink-2" htmlFor="sub-note">
        Ghi chú cho business
      </label>
      <textarea id="sub-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={cx(textarea, "mt-1.5")} placeholder="Tóm tắt những gì đã hoàn thành" />
    </Modal>
  );
}

/* ---------- Yêu cầu sửa ---------- */

function RevisionDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { dispatch } = useStore();
  const { ms } = useTarget(target);
  const [note, setNote] = useState("");
  const left = ms.revisionLimit - ms.revisionsUsed;
  return (
    <Modal
      open
      title="Yêu cầu sửa"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            disabled={!note.trim() || left <= 0}
            onClick={() => {
              dispatch({ type: "REQUEST_REVISION", ...target, note: note.trim() });
              onClose();
            }}
          >
            Gửi yêu cầu sửa
          </Button>
        </>
      }
    >
      <MilestoneLine t={target} />
      <p className="mb-2 text-sm text-ink-2">
        Còn <b className="text-amber">{left}</b>/{ms.revisionLimit} lượt sửa theo điều khoản đã khóa.
      </p>
      <textarea rows={3} autoFocus value={note} onChange={(e) => setNote(e.target.value)} className={textarea} placeholder="Cần sửa gì, đối chiếu tiêu chí nghiệm thu nào?" aria-label="Nội dung yêu cầu sửa" />
    </Modal>
  );
}

/* ---------- Yêu cầu hỗ trợ ---------- */

function DisputeDialog({ target, onClose }: { target: Target; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { ws, ms } = useTarget(target);
  const files = ws.attachments.filter((a) => a.milestoneId === ms.id || !a.milestoneId);
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<string[]>(files.map((f) => f.id));
  const pack = usePackSummary(ws.id);
  return (
    <Modal
      open
      title="Yêu cầu hỗ trợ"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={() => {
              dispatch({
                type: "OPEN_DISPUTE",
                ...target,
                reason: reason.trim(),
                openedBy: me(state),
                evidenceAttachmentIds: picked,
              });
              onClose();
            }}
          >
            Gửi yêu cầu hỗ trợ
          </Button>
        </>
      }
    >
      <MilestoneLine t={target} />
      <p className="mb-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-[#ffb3b3] ring-1 ring-danger/30">
        Giai đoạn sẽ được tạm giữ. Hai bên có thể bổ sung thông tin trước khi Đội ngũ Nova đề xuất phương án xử lý.
      </p>
      <textarea rows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={textarea} placeholder="Mô tả bất đồng và thỏa thuận cần đối chiếu" aria-label="Nội dung cần hỗ trợ" />
      {pack && (
        <p className="mt-3 rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-ink-2 ring-1 ring-white/[0.06]">
          <span className="font-medium text-ink">Tự gửi kèm hồ sơ dự án:</span> thỏa thuận (phiên bản {pack.versions}), {pack.milestones} giai đoạn,{" "}
          {pack.submissions} bản nộp, {pack.events} sự kiện nhật ký và {pack.messages} tin nhắn. Bên kia cũng xem được hồ sơ này.
        </p>
      )}
      {files.length > 0 && (
        <fieldset className="mt-3">
          <legend className="mb-1.5 text-sm font-medium text-ink-2">Đính kèm bằng chứng</legend>
          {files.map((f) => (
            <label key={f.id} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm hover:bg-white/4">
              <input
                type="checkbox"
                className="size-4 accent-[#f5c542]"
                checked={picked.includes(f.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.id] : p.filter((x) => x !== f.id)))}
              />
              <span className="truncate">{f.name}</span>
              <span className="ml-auto font-mono text-xs text-muted">{shortHash(f.hash)}</span>
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}
