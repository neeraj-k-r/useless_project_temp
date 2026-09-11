import React, { useState } from 'react';
import { 
  MapPin, 
  Check, 
  Users, 
  X, 
  AlertTriangle, 
  Search, 
  Plus, 
  Compass, 
  Navigation,
  Sparkles
} from 'lucide-react';
import { Community } from '../types';
import { detectUserLocality, createCommunityFromCoordinates } from '../utils/keralaData';
import { useCommunity } from '../hooks/useCommunity';

interface CommunitySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  communities: Community[];
  selectedCommunityId: string;
  onSelect: (id: string) => void;
}

export const CommunitySelector: React.FC<CommunitySelectorProps> = ({
  isOpen,
  onClose,
  communities,
  selectedCommunityId,
  onSelect
}) => {
  const { addDynamicCommunity, createCustomCommunity } = useCommunity();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // New community form fields
  const [newName, setNewName] = useState('');
  const [newDistrict, setNewDistrict] = useState('Ernakulam');
  const [newPincode, setNewPincode] = useState('');
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = communities.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.pincode.includes(searchQuery)
  );

  const handleGPSDetect = async () => {
    setIsLocating(true);
    setCreateNotice(null);
    try {
      const res = await detectUserLocality(communities);
      if (res.isNewDynamicCommunity) {
        await addDynamicCommunity(res.community);
        onSelect(res.community.id);
        setCreateNotice(`Added & selected your detected locality: ${res.community.name}`);
      } else {
        onSelect(res.community.id);
        setCreateNotice(`Matched nearest hub: ${res.community.name}`);
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      console.warn('GPS detection notice:', e);
    } finally {
      setIsLocating(false);
    }
  };

  const handleCreateNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPincode.trim()) return;

    try {
      const created = await createCustomCommunity(
        newName.trim(),
        newDistrict.trim(),
        newPincode.trim()
      );
      onSelect(created.id);
      setIsAddingNew(false);
      setNewName('');
      setNewPincode('');
      onClose();
    } catch (e) {
      console.warn('Error creating custom community:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-display text-white">
              Select or Expand Your Region
            </h3>
            <p className="text-xs text-slate-400">
              Community power consensus & torch signals are locality-scoped
            </p>
          </div>
        </div>

        {createNotice && (
          <div className="mb-3 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium">
            {createNotice}
          </div>
        )}

        {/* Search Bar & GPS Button */}
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search locality, district, or PIN (e.g. Kakkanad, Kaloor, 682030)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isLocating}
              onClick={handleGPSDetect}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-400 flex items-center justify-center gap-1.5 transition-colors"
            >
              {isLocating ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>Auto-detect via GPS</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNew ? 'Cancel' : '+ Add Neighborhood'}</span>
            </button>
          </div>
        </div>

        {/* Expandable "Add Custom Neighborhood" Form */}
        {isAddingNew && (
          <form onSubmit={handleCreateNewSubmit} className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-3 mb-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Register New Locality
              </span>
              <span className="text-[10px] text-amber-400/80">Available immediately to all neighbors</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  required
                  placeholder="Locality / Neighborhood Name (e.g. Kaloor Stadium)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <select
                  value={newDistrict}
                  onChange={e => setNewDistrict(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Ernakulam">Ernakulam</option>
                  <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                  <option value="Kozhikode">Kozhikode</option>
                  <option value="Thrissur">Thrissur</option>
                  <option value="Kannur">Kannur</option>
                  <option value="Kollam">Kollam</option>
                  <option value="Palakkad">Palakkad</option>
                  <option value="Kottayam">Kottayam</option>
                  <option value="Alappuzha">Alappuzha</option>
                  <option value="Malappuram">Malappuram</option>
                  <option value="Kasaragod">Kasaragod</option>
                  <option value="Pathanamthitta">Pathanamthitta</option>
                  <option value="Idukki">Idukki</option>
                  <option value="Wayanad">Wayanad</option>
                </select>
              </div>

              <div>
                <input
                  type="text"
                  required
                  placeholder="PIN Code (e.g. 682017)"
                  value={newPincode}
                  onChange={e => setNewPincode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              Create & Connect to this Locality 🔦
            </button>
          </form>
        )}

        {/* Communities List */}
        <div className="space-y-2 flex-1 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No matching communities found. You can click <strong>"+ Add Neighborhood"</strong> above to register it.
            </div>
          ) : (
            filtered.map((comm) => {
              const isSelected = comm.id === selectedCommunityId;
              return (
                <button
                  key={comm.id}
                  onClick={() => {
                    onSelect(comm.id);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-400 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{comm.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        PIN: {comm.pincode}
                      </span>
                      {comm.status === 'VERIFIED_OUTAGE' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-500/40 font-bold flex items-center gap-1">
                          🔴 OUTAGE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{comm.district} District</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <p className="text-[11px] text-slate-500 mt-3 text-center">
          🔒 Exact user coordinates are never displayed. Only locality-level consensus.
        </p>
      </div>
    </div>
  );
};

