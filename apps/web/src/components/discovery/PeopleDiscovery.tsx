import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VerificationBadge } from '../common/VerificationBadge';
import { SkillBadge } from '../common/SkillBadge';
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  MessageSquare,
  Sparkles,
  ExternalLink,
  BookOpen,
  FolderGit2,
  CheckCircle2,
  Clock,
  UserPlus,
} from 'lucide-react';
import { UserRole } from '../../types';

export const PeopleDiscovery: React.FC = () => {
  const {
    users,
    portfolio,
    openUserProfile,
    startConversationWithUser,
    setCollabTargetUser,
    setIsCollabModalOpen,
    connections,
    cancelConnectionRequest,
    respondToConnectionRequest,
    toggleSaveItem,
    isItemSaved,
    currentUser,
    globalSearch,
    setGlobalSearch,
  } = useApp();

  const [selectedRole, setSelectedRole] = useState<'all' | UserRole>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedAvailability, setSelectedAvailability] = useState<'all' | 'available' | 'selective'>('all');

  const departments = [
    'all',
    'Computer Science & Engineering',
    'Human-Computer Interaction & Product Design',
    'Electrical Engineering & Robotics',
    'Computational Biology & Statistics',
    'Department of Computer Science & Robotics',
  ];

  const filteredUsers = users.filter((u) => {
    // Hide council admin from standard talent listing if needed, or keep for openness
    if (u.role === 'council_admin') return false;

    // Search
    const term = globalSearch.toLowerCase().trim();
    if (term) {
      const matchName = u.name.toLowerCase().includes(term);
      const matchUsername = u.username.toLowerCase().includes(term);
      const matchHeadline = u.headline.toLowerCase().includes(term);
      const matchSkills = u.skills.some((s) => s.toLowerCase().includes(term));
      const matchInterests = u.collaborationInterests.some((i) => i.toLowerCase().includes(term));
      if (!matchName && !matchUsername && !matchHeadline && !matchSkills && !matchInterests) {
        return false;
      }
    }

    // Role filter
    if (selectedRole !== 'all' && u.role !== selectedRole) {
      return false;
    }

    // Department
    if (selectedDepartment !== 'all' && u.department !== selectedDepartment) {
      return false;
    }

    // Availability
    if (selectedAvailability !== 'all' && u.availability !== selectedAvailability) {
      return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Header & Description */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">People & Research Labs</h2>
          <p className="text-sm text-zinc-600 mt-1">
            Discover student developers, designers, hardware engineers, and faculty researchers open for collaboration.
          </p>
        </div>
        <div className="text-xs text-zinc-500">
          Showing <span className="font-semibold text-zinc-900">{filteredUsers.length}</span> verified campus profiles
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="py-4 flex flex-wrap items-center gap-3">
        {/* Search within People */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Filter by name, skill, or topic..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-400"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center rounded-lg border border-zinc-200 p-0.5 bg-zinc-50 text-xs">
          {(['all', 'student', 'professor'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRole(r)}
              className={`px-3 py-1 rounded-md capitalize font-medium transition-colors ${
                selectedRole === r
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {r === 'all' ? 'All Roles' : r === 'student' ? 'Students' : 'Faculty / Labs'}
            </button>
          ))}
        </div>

        {/* Department Filter */}
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none"
        >
          <option value="all">All Departments</option>
          <option value="Computer Science & Engineering">Computer Science & Eng</option>
          <option value="Human-Computer Interaction & Product Design">HCI & Product Design</option>
          <option value="Electrical Engineering & Robotics">Electrical & Robotics</option>
          <option value="Computational Biology & Statistics">Comp Bio & Stats</option>
          <option value="Department of Computer Science & Robotics">Faculty Robotics Dept</option>
        </select>

        {/* Availability Filter */}
        <select
          value={selectedAvailability}
          onChange={(e) => setSelectedAvailability(e.target.value as any)}
          className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none"
        >
          <option value="all">Any Availability</option>
          <option value="available">Open to Projects / Hackathons</option>
          <option value="selective">Selective Collaborations</option>
        </select>
      </div>

      {/* People Grid */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-zinc-200 mt-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 mt-3">No campus members found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query, department, or availability filter to find collaborators.
          </p>
          <button
            onClick={() => {
              setGlobalSearch('');
              setSelectedRole('all');
              setSelectedDepartment('all');
              setSelectedAvailability('all');
            }}
            className="mt-4 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {filteredUsers.map((user) => {
            const isSaved = isItemSaved('person', user.id);
            const userPortfolio = portfolio.filter((p) => p.userId === user.id);
            const isSelf = user.id === currentUser.id;

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl border border-zinc-200/90 hover:border-zinc-300 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Avatar, Identity & Save Button */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-12 h-12 rounded-xl object-cover border border-zinc-200 shrink-0"
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            user.availability === 'available' ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                          title={user.availabilityLabel}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3
                            onClick={() => openUserProfile(user.id)}
                            className="font-semibold text-zinc-900 text-sm hover:underline cursor-pointer"
                          >
                            {user.name}
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-tight mt-0.5">
                          {user.yearOrTitle}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{user.department}</p>
                      </div>
                    </div>

                    {/* Bookmark */}
                    <button
                      onClick={() => toggleSaveItem('person', user.id)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        isSaved
                          ? 'border-blue-200 bg-blue-50 text-blue-600'
                          : 'border-zinc-200 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
                      }`}
                      title={isSaved ? 'Saved to bookmarks' : 'Save member'}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Badges & Status */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <VerificationBadge verification={user.verification} size="sm" />
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                        user.availability === 'available'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                          : 'bg-amber-50 text-amber-700 border-amber-200/60'
                      }`}
                    >
                      {user.availabilityLabel}
                    </span>
                  </div>

                  {/* Headline */}
                  <p className="text-xs text-zinc-700 mt-3 line-clamp-2 leading-relaxed font-normal">
                    {user.headline}
                  </p>

                  {/* Top Skills Tags */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {user.skills.slice(0, 4).map((skill) => (
                      <SkillBadge key={skill} skill={skill} size="xs" />
                    ))}
                    {user.skills.length > 4 && (
                      <span className="text-[11px] text-zinc-400 self-center pl-1">
                        +{user.skills.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Portfolio Showcase Snippet */}
                  {userPortfolio.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-zinc-100">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FolderGit2 className="w-3 h-3" />
                        Featured Portfolio Work
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {userPortfolio.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            onClick={() => openUserProfile(user.id)}
                            className="group/item cursor-pointer rounded-lg border border-zinc-200/70 p-1.5 hover:border-zinc-400 transition-colors bg-zinc-50/50"
                          >
                            <img
                              src={item.coverImage}
                              alt={item.title}
                              className="w-full h-14 object-cover rounded-md mb-1"
                            />
                            <div className="text-[11px] font-medium text-zinc-800 truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-zinc-500 capitalize">{item.category}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Academic Publications snippet for faculty */}
                  {user.publications && user.publications.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-100 text-xs text-zinc-600 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                      <span>
                        <strong className="text-zinc-900">{user.stats.publicationsCount || user.publications.length}</strong> peer-reviewed publications
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => openUserProfile(user.id)}
                    className="text-xs text-zinc-600 hover:text-zinc-900 font-medium py-1.5"
                  >
                    View Full Profile
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!isSelf && (() => {
                      // Connection states (professional connections — separate
                      // from follows/project collaboration/messaging)
                      const conn = connections.find(
                        (c) =>
                          (c.requesterId === currentUser.id && c.addresseeId === user.id) ||
                          (c.addresseeId === currentUser.id && c.requesterId === user.id),
                      );
                      const outgoingPending = conn?.status === 'pending' && conn.requesterId === currentUser.id;
                      const incomingPending = conn?.status === 'pending' && conn.addresseeId === currentUser.id;
                      const connected = conn?.status === 'accepted';
                      const incomingFromMe = conn?.status === 'pending' && conn.addresseeId === currentUser.id;

                      if (connected) {
                        return (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Connected
                          </span>
                        );
                      }
                      if (outgoingPending) {
                        return (
                          <button
                            onClick={() => cancelConnectionRequest(conn!.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-200 hover:bg-amber-100 transition-colors"
                            title="Cancel your connection request"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            Request Sent
                          </button>
                        );
                      }
                      if (incomingPending) {
                        return (
                          <>
                            <button
                              onClick={() => respondToConnectionRequest(conn!.id, 'declined')}
                              className="px-2.5 py-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 rounded-lg text-xs font-medium transition-colors"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => respondToConnectionRequest(conn!.id, 'accepted')}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                              Accept
                            </button>
                          </>
                        );
                      }
                      return (
                        <>
                          <button
                            onClick={() => startConversationWithUser(user.id)}
                            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                            title={connected ? 'Send a message' : incomingFromMe ? 'They want to connect — reply to unlock' : 'Message them (your first message is a request they can reply to)'}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setCollabTargetUser(user);
                              setIsCollabModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>Connect</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
