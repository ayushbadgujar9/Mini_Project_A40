/**
 * app/(tabs)/jobs.jsx
 * FairConnect Mobile — Browse Jobs Tab
 *
 * Mirrors web WorkerFeed / NearbyJobFilter:
 *  • GET /api/jobs with pagination
 *  • Skill filter chips
 *  • Job cards with apply button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { getJobs, applyForJob } from '../../services/api';

const SKILL_FILTERS = [
  'All', 'Electrician', 'Plumber', 'Carpenter', 'Welder',
  'Painter', 'Mason', 'Fitter', 'Mechanic',
];

function JobCard({ job, onApply }) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  async function handleApply() {
    if (applied) return;
    setApplying(true);
    try {
      await onApply(job._id);
      setApplied(true);
    } catch (_) {}
    setApplying(false);
  }

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 }} numberOfLines={1}>
          {job.title || 'Job Opening'}
        </Text>
        {job.requiresVerification && (
          <View
            style={{
              backgroundColor: '#ecfdf5',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: '#6ee7b7',
              marginLeft: 6,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#065f46' }}>✓ Verified Only</Text>
          </View>
        )}
      </View>

      {/* Employer & Location */}
      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
        🏢 {job.employerName || job.employer?.name || 'Employer'} · 📍 {job.location || 'Location TBD'}
      </Text>

      {/* Skills required */}
      {job.skillsRequired?.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {job.skillsRequired.slice(0, 3).map((skill, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: '#eff6ff',
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: '#bfdbfe',
              }}
            >
              <Text style={{ fontSize: 11, color: '#1d4ed8', fontWeight: '600' }}>
                {skill}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Pay & Duration */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
        {job.payPerDay && (
          <Text style={{ fontSize: 12, color: '#374151' }}>
            💰 ₹{job.payPerDay}/day
          </Text>
        )}
        {job.duration && (
          <Text style={{ fontSize: 12, color: '#374151' }}>
            📅 {job.duration}
          </Text>
        )}
      </View>

      {/* Apply button */}
      <TouchableOpacity
        onPress={handleApply}
        disabled={applying || applied}
        style={{
          backgroundColor: applied ? '#6b7280' : '#059669',
          borderRadius: 8,
          paddingVertical: 10,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
        }}
        activeOpacity={0.8}
      >
        {applying ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
            {applied ? '✓ Applied' : 'Apply Now'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('All');

  const fetchJobs = useCallback(async () => {
    try {
      const params = {};
      if (selectedSkill !== 'All') params.skill = selectedSkill;
      if (search.trim()) params.search = search.trim();
      const { data } = await getJobs(params);
      setJobs(Array.isArray(data) ? data : data.jobs || []);
    } catch (err) {
      console.warn('[Jobs] Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSkill, search]);

  useEffect(() => {
    fetchJobs();
  }, [selectedSkill]);

  function onRefresh() {
    setRefreshing(true);
    fetchJobs();
  }

  async function handleApply(jobId) {
    await applyForJob(jobId, {});
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Search bar */}
      <View
        style={{
          backgroundColor: '#fff',
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        }}
      >
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={fetchJobs}
          placeholder="🔍 Search jobs by title or location…"
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          style={{
            borderWidth: 1,
            borderColor: '#d1d5db',
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 14,
            color: '#111827',
            backgroundColor: '#f9fafb',
          }}
        />
      </View>

      {/* Skill filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: 10, gap: 8 }}
        style={{ maxHeight: 54, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}
      >
        {SKILL_FILTERS.map((skill) => (
          <TouchableOpacity
            key={skill}
            onPress={() => setSelectedSkill(skill)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: selectedSkill === skill ? '#059669' : '#f3f4f6',
              borderWidth: 1,
              borderColor: selectedSkill === skill ? '#059669' : '#e5e7eb',
            }}
            activeOpacity={0.7}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: selectedSkill === skill ? '#fff' : '#374151',
              }}
            >
              {skill}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Jobs list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item, idx) => item._id || String(idx)}
          renderItem={({ item }) => <JobCard job={item} onApply={handleApply} />}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>No jobs found</Text>
              <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                Try a different skill filter or search term
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
